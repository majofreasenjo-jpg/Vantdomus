# legacy/ — Archive of pre-Improved VantDomus releases

This directory holds frozen copies of older VantDomus builds (v04, v05,
v06 and bundle archives). They predate the **VantDomus Improved**
reorganisation and are kept only as historical reference. Nothing in
`apps/`, `tests/`, or `tools/` should import from here.

## Why this is a problem

- **Repo bloat.** Each archived build duplicates `node_modules` patterns,
  config samples, and demo data; collectively it slows clones and CI.
- **Secret scan blind spot.** `tools/secret_scan.py` deliberately skips
  `legacy/` (see `SKIP_DIRS`). Any credential accidentally left in these
  archives — `.env.example` files, demo tokens, hardcoded URLs — will
  not surface in the security gate, even though it sits in version
  control and ships with every clone.
- **Cognitive cost.** New contributors see four near-identical
  `vantdomus_panel/` trees and waste time figuring out which one is
  current. (Hint: none of them. The current panel is `apps/web/`.)

## What to do

Pick one of the following based on how often you actually consult these
files:

### Option A — Move to a separate archive repository (recommended)
```powershell
# From the parent directory of VantDomus_Improved
git clone --bare D:\path\to\original-archive vantdomus-legacy-archive.git
# Or: create a new repo and push the legacy/ contents to it
cd VantDomus_Improved
git rm -r --cached legacy        # if it was ever tracked here
Remove-Item -Recurse legacy      # then physically delete the directory
```
Push the archive repo to a private GitHub org with restricted access.
Reference it from the main repo's `README.md` if needed.

### Option B — Compress into a single archive on shared storage
```powershell
Compress-Archive -Path legacy -DestinationPath vantdomus-legacy-2026-05.zip
# Upload the .zip to OneDrive / Drive / S3 Glacier
Remove-Item -Recurse legacy
```

### Option C — Keep locally for now (status quo)
The current `.gitignore` excludes `legacy/` from commits, so nothing leaks
into git history. The cost is local disk space (~600 KB across all
versions, manageable) and the documented blind spot in `secret_scan.py`.

## Until you choose one of the above

- Do **not** add new files here.
- Do **not** copy code from `legacy/` into `apps/` — re-implement properly.
- If you do consult an old version for reference, leave a comment in the
  current code explaining the intent ("see legacy/v05/...") rather than
  copy-pasting.
