# DOMI P5 — Live Infrastructure Reuse Audit

DATE=2026-10-01
MODE=READ_ONLY_NON_DESTRUCTIVE

## Vercel

```text
vantdomus-family-pilot = READY
latest deployment = dpl_D7bUM3HFu4soW2Gofuq1cvh3fkUM
decision = USE AS CURRENT WEB PREVIEW / STAGING-WEB CANDIDATE
mutation = NONE

vantdomus-hogar-demo = READY
latest deployment = dpl_2qY2eDFPjSN8rgEkXymCvNkXhYpc
decision = PRESERVE AS DEMO SURFACE
repurpose = FORBIDDEN WITHOUT OWNER CONFIRMATION

vantdomus-panel = ERROR
latest deployment = dpl_2MXnaHfCVEYWB7g8rkimeiRY6NLF
decision = PRESERVE / DO NOT USE UNTIL ROOT CAUSE AUDIT

vantdomus-mobile = ERROR
latest deployment = dpl_7rGhGFEAZavDgZhCToJCMYX4mDsp
decision = PRESERVE / DO NOT USE UNTIL ROOT CAUSE AUDIT
```

## Supabase

Organization plan observed:

```text
tier = free
```

Projects:

```text
Bases de datos Project
region = us-west-2
status = ACTIVE_HEALTHY
observed public table = goc_external_staging_effects
decision = DO NOT REUSE FOR DOMI

LUXTMENT Commercial OS
region = sa-east-1
status = ACTIVE_HEALTHY
decision = DO NOT REUSE FOR DOMI
```

The first project is not empty and already contains GOC/POIEX staging semantics.
The second is a heavily populated commercial/EDIS data plane.

Therefore a dedicated DOMI staging database remains required.

## Safe reuse decision

Available infrastructure we can use now without destructive action:

```text
GitHub repository / Actions = USE
Vercel vantdomus-family-pilot Preview = USE
Vercel vantdomus-hogar-demo = PRESERVE AS DEMO SURFACE
Existing Supabase projects = INSPECT ONLY / DO NOT REPURPOSE
```

## Current boundary

No deletion, project rename, environment overwrite, schema mutation, or database reuse was performed.

```text
PROVISIONING_AUTHORIZED=FALSE
STAGING_DEPLOYMENT_AUTHORIZED=FALSE
PRODUCTION_MUTATION=FALSE
```
