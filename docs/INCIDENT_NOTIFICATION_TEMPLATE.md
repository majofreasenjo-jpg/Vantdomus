# Incident Notification Template

Use this template for customer-facing incident communication after internal triage confirms customer impact. Adapt with counsel.

## Initial Notice

Subject: VantDomus Security Notice - Incident `<incident_id>`

Hello `<customer_contact>`,

We are notifying you about a security or operational incident affecting `<customer_or_tenant_name>`.

Known facts:

- Incident id: `<incident_id>`
- Detected at: `<timestamp_with_timezone>`
- Current status: investigating / contained / resolved
- Affected environment: staging / production
- Affected data categories: `<categories_or_unknown>`
- Affected users/units: `<scope_or_unknown>`

Actions already taken:

- `<containment_action_1>`
- `<containment_action_2>`
- `<credential_or_token_rotation_if_any>`

Actions requested from you:

- `<customer_action_or_none>`

Next update:

- We will provide the next update by `<timestamp_with_timezone>` or sooner if material facts change.

Contact:

- `<incident_contact_channel>`

## Follow-Up Update

Subject: VantDomus Security Update - Incident `<incident_id>`

Update since last notice:

- `<new_fact_1>`
- `<new_fact_2>`

Current assessment:

- Data impact: confirmed / not confirmed / still under investigation
- Service impact: `<impact>`
- Containment status: `<status>`

Next steps:

- `<next_step_1>`
- `<next_step_2>`

Next update:

- `<timestamp_with_timezone>`

## Closure Notice

Subject: VantDomus Security Closure - Incident `<incident_id>`

The incident has been closed.

Summary:

- Root cause: `<root_cause>`
- Customer impact: `<impact>`
- Data impact: `<data_impact>`
- Time to detection: `<duration>`
- Time to containment: `<duration>`

Remediation completed:

- `<remediation_1>`
- `<remediation_2>`

Preventive actions:

- `<preventive_action_1>`
- `<preventive_action_2>`

Evidence retained:

- audit/security event package id: `<evidence_id>`
- retention period: `<period>`
