# Scripts manuales (NO son tests automáticos)

Estos scripts provienen del commit inicial del proyecto y **llaman servicios
externos** (el viejo backend de Render) al importarse. Por eso:

- **Nunca** se recolectan con pytest (excluidos vía `pytest.ini`
  `norecursedirs = tests/manual` y renombrados sin el prefijo `test_`).
- Se ejecutan solo a mano y bajo demanda: `python tests/manual/<script>.py`.
- Ningún test automático de la suite debe realizar llamadas de red.

| Script | Origen |
|---|---|
| `manual_chat_check.py` | `test_chat.py` (legacy) |
| `manual_dashboard_check.py` | `test_dashboard.py` (legacy) |
| `manual_dashboard_404_check.py` | `test_dashboard_404.py` (legacy) |
| `manual_render_db_check.py` | `test_render_db.py` (legacy) |
