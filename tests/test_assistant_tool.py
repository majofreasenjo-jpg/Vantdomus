import sys
import traceback
sys.path.append("D:/Aplicaciones de Juegos/VantDomus/vantdomus_core")

try:
    from app.db import connect
    from app.routes.assistant import _openai_chat_agentic
    db = connect()
    household_id = "288e2700-07df-4217-993a-3a4087ac3657"
    msgs = [
        {"role": "system", "content": "You are VantUnit Field Agent. You process instructions from the 'Buzón de Campo'. Your available tools include 'generate_claim_report'."},
        {"role": "user", "content": "Hola VantUnit, por favor genera el archivo Excel de la Línea de Tiempo de Claims para PUMA Antucoya."}
    ]
    model = "gpt-4.1-mini"
    print("Enviando petición a LLM...", flush=True)
    reply = _openai_chat_agentic(msgs, model=model, temperature=0.2, db=db, household_id=household_id)
    print("RESPUESTA:", reply)
except Exception as e:
    print("ERRORESSS:", str(e))
    traceback.print_exc()
