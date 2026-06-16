import sys
import traceback
sys.path.append("D:/Aplicaciones de Juegos/VantDomus/vantdomus_core")

try:
    from app.db import connect
    from app.routes.logbook import create_entry
    db = connect()
    household_id = "288e2700-07df-4217-993a-3a4087ac3657"
    
    class MockUser:
        def __getitem__(self, key):
            return "44698693-10c8-4e0c-9289-1f7817edc943"

    print("Subiendo instrucción al logbook...")
    res = create_entry(
        household_id=household_id,
        entry_type="instruccion",
        content="Hola equipo, por favor genera el Excel de la Línea de Tiempo de Claims V2",
        event_date=None,
        file=None,
        user=MockUser(),
        db=db
    )
    
    print("RES", res)
    
    # Check what got written
    rows = db.execute("SELECT content FROM logbook_entries WHERE household_id=? ORDER BY created_at DESC LIMIT 2", (household_id,)).fetchall()
    for r in rows:
        print(" ->", r["content"])
except Exception as e:
    print("ERRORESSS:", str(e))
    traceback.print_exc()
