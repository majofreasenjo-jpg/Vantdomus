# data/ — NOT for the application repository

This directory currently holds real customer artefacts (PUMA contracts,
offers, schedules, spreadsheets, etc.) — totalling several GB. **None of
this belongs inside the application monorepo.** Mixing customer data with
source code creates several problems:

- **Confidentiality.** A `git push` of the wrong branch leaks the entire
  customer dataset to anyone with repo access (or to GitHub if the repo
  ever goes public by accident).
- **Repo size.** Multi-GB binary blobs make every clone, every CI run, and
  every backup slower and more expensive.
- **Compliance.** A B2B operational platform that ships customer documents
  embedded in source artifacts has no clean audit story for retention,
  deletion-on-request, or per-tenant access control.

The contents of this directory are excluded from version control by
`.gitignore`. They remain on disk only because they have not yet been
relocated.

## Where this data should live

Pick one of these patterns based on the data class:

### 1. Customer-owned operational documents (contracts, offers, schedules)
Move to an **object store with tenant isolation**:
- AWS S3 (or compatible: Cloudflare R2, Backblaze B2) with bucket-per-tenant
  or prefix-per-tenant and KMS-encryption at rest.
- Per-tenant IAM policies; signed-URL access from the API.
- Lifecycle rules for retention and deletion-on-request.

### 2. Working copies for ad-hoc analysis
Keep in a private OneDrive / Google Drive folder tied to your account,
**not** under the application source tree. The API never reads from that
location directly.

### 3. Synthetic fixtures (safe to share)
If a smaller, anonymised version of this data is useful for tests, place
it under `tests/fixtures/` (small files only, no PII) and document its
provenance.

## Migration checklist

- [ ] Inventory: list every file currently under `data/`, classify by
      sensitivity (PII / commercial / synthetic).
- [ ] Pick the target store (object storage or document vault) and create
      tenant-isolated locations.
- [ ] Upload current files; verify checksums.
- [ ] Update any API code that reads from a local `data/` path to point at
      the new store (search for `Path("data/")` and similar).
- [ ] Once the new location is the source of truth, delete the local
      `data/` directory.

Until that is done, do **not** add files to `data/`, do **not** commit
this directory, and do **not** rely on its contents from production code.
