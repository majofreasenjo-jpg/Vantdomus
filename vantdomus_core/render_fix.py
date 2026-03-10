import os
import psycopg2
from datetime import datetime

print("Conectando a Neon desde Render...")
url = os.environ.get("DATABASE_URL")
if not url:
    print("X: Falta DATABASE_URL en entorno local.")
    exit(1)

conn = psycopg2.connect(url)
cursor = conn.cursor()

user_id = "44698693-10c8-4e0c-9289-1f7817edc943"
household_id = "288e2700-07df-4217-993a-3a4087ac3657"

print("Comprobando membresia...")
cursor.execute("SELECT role FROM household_memberships WHERE user_id=%s AND household_id=%s", (user_id, household_id))
if cursor.fetchone():
    print("Ya es miembro. Actualizando a owner...")
    cursor.execute("UPDATE household_memberships SET role='owner' WHERE user_id=%s AND household_id=%s", (user_id, household_id))
else:
    print("Insertando nuevo rol owner...")
    cursor.execute("INSERT INTO household_memberships (household_id, user_id, role, created_at) VALUES (%s, %s, %s, %s)", 
                   (household_id, user_id, "owner", datetime.utcnow().isoformat()))

conn.commit()
print("Membresia reparada exitosamente!")
