# Security Hardening Runbook (VantDomus Improved — May 2026)

This runbook walks through every manual step that the security hardening
pass left for the operator. The code-side changes are already applied;
what's listed here are actions only **you** can do (rotate live
credentials, run installers, inspect git remotes, etc.).

Do these **in order**. Each section is idempotent — safe to re-run if
something gets interrupted.

---

## Section 1 — Final sanity check (5 min)

Before anything else, confirm the working tree is what we expect.

```powershell
cd "D:\Aplicaciones de Juegos\VantDomus_Improved"

# 1.1 Status: should list untracked files, no commits yet
git status

# 1.2 Confirm dangerous files are GONE (commands below should ALL print "GONE")
foreach ($f in @(
  "apps\api\fix_admin_auth.py",
  "apps\api\link_demo_user.py",
  "apps\api\render_fix.py",
  "apps\web\hack_db.js",
  "apps\web\.env.local",
  "apps\mobile\bundle.js",
  "apps\mobile\install_error.txt"
)) {
  if (Test-Path $f) { Write-Host "PRESENT: $f" } else { Write-Host "GONE:    $f" }
}

# 1.3 Run the secret scanner one last time
python tools\secret_scan.py
```

**Expected:** all 7 files report `GONE`. The secret scan output should
end with `"ok": true` and `"findings": []`.

If anything is `PRESENT`, stop and delete it manually before continuing:

```powershell
Remove-Item "apps\<the_file>"
```

---

## Section 2 — Initial commit (2 min)

```powershell
# 2.1 Set git identity (only if you haven't already)
git config user.email "majofreasenjo@gmail.com"
git config user.name "Manuel"

# 2.2 Stage everything that's NOT gitignored
git add .

# 2.3 Look at what's staged — sanity check before commit
git status

#     Verify NOTHING from data/ (except data/README.md) is listed.
#     Verify NOTHING from legacy/ (except legacy/README.md) is listed.
#     Verify NO *.db file is listed.

# 2.4 Commit
git commit -m "Initial commit: post-security-cleanup baseline"

# 2.5 Tag this baseline so we can return to it if something breaks
git tag baseline-secure-2026-05
git log --oneline
```

If `git status` in step 2.3 shows something unexpected,
do **not** commit. Pegame el output y arreglamos.

---

## Section 3 — Rotate the Neon Postgres password (15 min)

The previous `apps/api/fix_admin_auth.py` and `link_demo_user.py` hardcoded
the Neon owner password `npg_g0vIfuVdC8bM`. That file may also have been
shared by chat, copied to backups, or pushed to a remote git host. Assume
the password is compromised.

### 3.1 Generate a new password
On Neon's dashboard:
1. Open the project `vantdomus_neon`.
2. Go to **Settings → Database → Roles → vantdomus_neon_owner**.
3. Click **Reset password**. Copy the new value somewhere temporary.

### 3.2 Update every service that uses it
The compromised connection string was:
```
postgresql://vantdomus_neon_owner:npg_g0vIfuVdC8bM@ep-divine-violet-a8z26v0u-pooler.eastus2.azure.neon.tech/vantdomus_neon
```
Search for every place it's configured today and replace the password:

- **Render** (or whatever hosts the API): Dashboard → Service → Environment → `DATABASE_URL`.
- **Vercel** (web panel): Dashboard → Project → Settings → Environment Variables → `DATABASE_URL` (if present).
- **Your local dev**: `apps/api/.env.local`, `apps/api/.env` — open and replace.
- **Any GitHub Actions secret named `DATABASE_URL`**.

### 3.3 Verify rotation
After updating every service, run a smoke test:

```powershell
# From Render shell, or against the live API:
curl https://vantdomus-backend.onrender.com/health
```

If the API still answers `{"status":"ok"}`, the new password works in
production. If you get DB connection errors, you missed a config slot.

---

## Section 4 — Rotate the API JWT secret (10 min)

The token committed in `apps/web/.env.local` was signed with the
production `JWT_SECRET`. Until you rotate the secret, that token is
valid as a bearer for the demo user until its `exp` (2026).

### 4.1 Generate a strong new secret
```powershell
# Windows PowerShell
$bytes = New-Object Byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToHexString($bytes).ToLower()
```
or on Linux/macOS:
```bash
openssl rand -hex 32
```
Copy the output — you'll paste it into the hosting env in the next step.

### 4.2 Update `JWT_SECRET` on every service
- **Render** (API): Environment → `JWT_SECRET` → paste new value → Save & redeploy.
- **Local dev**: `apps/api/.env` or `apps/api/.env.local` → paste new value.
- **GitHub Actions** secrets if any test job uses a real JWT (usually not — tests use synthetic secrets).

### 4.3 Confirm rotation
After the API redeploys with the new secret, every session minted before
the rotation is invalid. Users will need to log in again (this is what you
want — the compromised demo token is now useless).

```powershell
# Optional: try the leaked token against /me — should now return 401
$leakedToken = "eyJhbGciOi..."   # the one from the old .env.local
curl -H "Authorization: Bearer $leakedToken" `
     https://vantdomus-backend.onrender.com/auth/me
# Expected: HTTP 401 "Invalid token"
```

---

## Section 5 — Check for previous pushes to a remote (10 min)

You said this repo has no commits yet locally, but the **original**
project (`D:\Aplicaciones de Juegos\VantDomus`, before the Improved
copy) may have a remote with the leaked credentials in its history.

### 5.1 Inspect remotes of the original repo
```powershell
cd "D:\Aplicaciones de Juegos\VantDomus"   # or wherever the original lives
git remote -v
```

- No remotes? Skip section 5 entirely.
- A remote exists? Continue.

### 5.2 Look for the leaked password in the original history
```powershell
git log --all --full-history -p -S "npg_g0vIfuVdC8bM" 2>$null | Select-Object -First 30
git log --all --full-history -p -S "vantdomus_neon_owner" 2>$null | Select-Object -First 30
```

If those commands print any output, the credentials ARE in your remote
history. Two ways out, pick one:

### 5.3a Make the remote repo private + revoke + move on (fastest)
1. On GitHub/GitLab, set the repo to **private** (or delete it).
2. The Neon password rotation in Section 3 already neutralises the leak.
3. Internal compromise still possible — anyone who had access in the
   past read the creds. Audit collaborator list.

### 5.3b Rewrite history with BFG (cleaner but slower)
```powershell
# Download bfg.jar from https://rtyley.github.io/bfg-repo-cleaner/
java -jar bfg.jar --replace-text passwords.txt path\to\original-repo.git
# Where passwords.txt has the literal strings to scrub, one per line.
git -C path\to\original-repo.git reflog expire --expire=now --all
git -C path\to\original-repo.git gc --prune=now --aggressive
git -C path\to\original-repo.git push --force --all
git -C path\to\original-repo.git push --force --tags
```
This rewrites history. **Coordinate with anyone who has a clone** —
they'll need to re-clone after the force-push.

---

## Section 6 — Install `expo-secure-store` (5 min)

I added `"expo-secure-store": "~15.0.0"` to `apps/mobile/package.json`,
but the lockfile (`package-lock.json`) doesn't exist yet and the version
pin should match what your SDK actually expects.

```powershell
cd "D:\Aplicaciones de Juegos\VantDomus_Improved\apps\mobile"
npx expo install expo-secure-store
```

This will:
- Pick the exact version compatible with your Expo SDK.
- Update `package.json` to that version.
- Update `package-lock.json`.

If `npx expo` errors with "command not found", install once globally:
```powershell
npm install -g expo
```

Run the dev server once after to confirm nothing crashes:
```powershell
npm run start
```
Login should still work; the JWT will land in Keychain/Keystore.

---

## Section 7 — Verify the web middleware (`proxy.ts`) is active (10 min)

The audit flagged that the `middleware-manifest.json` in your build was
empty, meaning the edge auth gate may not have been compiled. After my
changes, you need to rebuild and verify.

```powershell
cd "D:\Aplicaciones de Juegos\VantDomus_Improved\apps\web"
npm ci
npm run build

# Check the manifest after build
type .next\server\middleware-manifest.json
```

The output should contain a non-empty `"middleware"` object with a
matcher referencing `proxy.ts` (the exact field name varies by Next
version).

If the manifest is empty (`"middleware": {}`):
- Next 16 calls it `proxy.ts` (correct), but if your Next version reverts
  the rename you may need to copy `apps/web/proxy.ts` → `apps/web/middleware.ts`
  and re-run `npm run build`.
- Open `D:\Aplicaciones de Juegos\VantDomus_Improved\apps\web\proxy.ts`,
  comment the file path at the top, and confirm the `export const config`
  block lists every protected route prefix.

### 7.1 Functional check
Once the manifest is non-empty, run a quick smoke test:

```powershell
npm run dev
# In a separate terminal:
curl -i http://localhost:3000/dashboard
```
Expected: **307 redirect to /login** (because you have no session
cookie). If you get 200 with the dashboard HTML, the middleware is not
gating — open an issue and we'll dig further.

---

## Section 8 — Regenerate `requirements.txt` with pip-tools (15 min)

I pinned the API requirements with `==` floors, but a real reproducible
build needs a lockfile that captures all transitive deps too.

```powershell
cd "D:\Aplicaciones de Juegos\VantDomus_Improved\apps\api"

# Install pip-tools
pip install pip-tools

# Convert current requirements.txt to requirements.in (just rename)
Copy-Item requirements.txt requirements.in

# Compile with all transitive deps + hashes
pip-compile --strip-extras --generate-hashes --output-file requirements.txt requirements.in

# Audit the resulting lockfile
pip-audit -r requirements.txt --strict
```

If `pip-audit` reports vulnerable transitive deps, bump the relevant
package in `requirements.in` and recompile until it's clean.

---

## Section 9 — Push the cleaned repo to a fresh remote (10 min)

After all of the above, the local commit is good and credentials are
rotated. Now push to a remote.

### 9.1 Create a **new, private** remote
- GitHub: **New repository** → name `vantdomus-improved` → **Private** → no README, no .gitignore (we have them) → Create.
- Copy the SSH URL (`git@github.com:<you>/vantdomus-improved.git`).

### 9.2 Wire and push
```powershell
cd "D:\Aplicaciones de Juegos\VantDomus_Improved"

git remote add origin git@github.com:<you>/vantdomus-improved.git
git push -u origin master   # or main, depending on your default
git push origin baseline-secure-2026-05
```

### 9.3 Make the secret-gate workflow a required check
On the remote repo: **Settings → Branches → Branch protection rules →
Add rule** for `master`. Require:
- Status checks: `Security Gate / backend`, `Security Gate / web`, `Security Gate / mobile`.
- Require pull request reviews before merging.

That way no future commit can land if it reintroduces a leaked secret,
a failing typecheck, or a regressed test.

---

## Section 10 — Post-rotation verification checklist

After everything above, tick these off so you can sleep:

- [ ] Old Neon password `npg_g0vIfuVdC8bM` rejected by `psql`.
- [ ] Leaked JWT (`eyJhbGciOi...`) returns 401 from `/auth/me`.
- [ ] `apps/web/.env.local` does **not** exist on disk.
- [ ] `apps/web/hack_db.js` does **not** exist on disk.
- [ ] `git log --oneline` shows a single baseline commit.
- [ ] Remote repo on GitHub is **Private**.
- [ ] CI workflow on the remote runs `backend`, `web`, `mobile` jobs and
      they all turn green on a PR.
- [ ] You ran `python tools/secret_scan.py` from the CI run output and
      saw `"ok": true`.
- [ ] Mobile app starts; login still works; token lands in SecureStore
      (you can verify by clearing AsyncStorage in Expo's dev menu — the
      session should survive).

When every box is checked, the critical security debt from the audit is
closed. Remaining work (tests for more routes, legal pack, infra
binding) is tracked in `docs/PRODUCTION_READINESS_7_POINT_PLAN.md`.
