# Assistant Architecture

The VantUnit assistant is split into small modules under `apps/api/app/assistant`.

## Modules

- `schemas.py`: request/response input models for chat.
- `context.py`: household metadata, taxonomy, fallback context, system prompt and CEO P&L context.
- `tools.py`: auditable tool definitions plus local tool execution.
- `service.py`: OpenAI chat loop and tool-call orchestration.

`apps/api/app/routes/assistant.py` should stay thin: it owns HTTP permissions, request handling and response shape only.

## Tool safety

Tools that mutate product data write to the current database tables:

- `create_operational_task` writes to `task_items`.
- `register_financial_expense` writes to `expenses`.

Document/report generation is disabled unless explicitly configured with environment variables:

- `VANTDOMUS_CLAIM_REPORT_DIR`
- `VANTDOMUS_CLAIM_REPORT_SCRIPT`
- `VANTDOMUS_LETTER_GENERATOR`
- `VANTDOMUS_LETTER_OUTPUT_DIR`

This prevents the improved repo from accidentally executing scripts or writing outputs into the original `D:\Aplicaciones de Juegos\VantDomus` tree.

## Next hardening step

Add an `assistant_action_log` table and record every tool call with:

- user id
- household id
- tool name
- arguments
- result
- created timestamp

After that, add confirmation gates for document generation and any external script execution.
