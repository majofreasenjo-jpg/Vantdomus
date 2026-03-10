VantDomus v0.4 Planning Assistant Add-on (SQLite)

Contenido:
- sqlite_migrations/040_planning_assistant.sql
- app/planner.py
- app/routes/assistant.py

Pasos:
1. Ejecutar migración SQLite.
2. Importar router assistant en main.py:
   from app.routes import assistant
   app.include_router(assistant.router)

3. Reiniciar backend.
