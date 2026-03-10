import sys
try:
    from app.db import connect
except ImportError as e:
    print(f"Error importando app: {e}")
    sys.exit(1)

def fix_membership():
    print("Iniciando inyección de membresía...")
    from app.config import settings
    settings.DATABASE_URL = "postgresql://vantdomus_neon_owner:npg_g0vIfuVdC8bM@ep-divine-violet-a8z26v0u-pooler.eastus2.azure.neon.tech/vantdomus_neon?sslmode=require"
    
    conn = connect()
    cursor = conn.cursor()
    
    user_id = "44698693-10c8-4e0c-9289-1f7817edc943"
    household_id = "288e2700-07df-4217-993a-3a4087ac3657"
    
    # Check si ya existe
    cursor.execute("SELECT role FROM household_memberships WHERE user_id=%s AND household_id=%s", (user_id, household_id))
    row = cursor.fetchone()
    if row:
        print(f"El usuario ya es miembro con rol: {row['role']}")
        # Forzar OWNER por si acaso
        cursor.execute("UPDATE household_memberships SET role='owner' WHERE user_id=%s AND household_id=%s", (user_id, household_id))
    else:
        print("El usuario NO es miembro. Insertando rol de Owner...")
        from datetime import datetime
        now_ts = datetime.utcnow().isoformat()
        cursor.execute("INSERT INTO household_memberships (household_id, user_id, role, created_at) VALUES (%s, %s, %s, %s)", 
                   (household_id, user_id, "owner", now_ts))
    
    conn.commit()
    print("Membresía aplicada en Neon DB Exitosamente!")

if __name__ == "__main__":
    fix_membership()
