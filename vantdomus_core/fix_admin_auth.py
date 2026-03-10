import sys
import os
import json

# Agregar path para importar módulos de la app
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

try:
    from app.security import create_access_token, hash_password
    from app.db import connect
except ImportError as e:
    print(f"Error importando app: {e}")
    sys.exit(1)

def fix_admin():
    print("Iniciando bypass de auth...")
    # 1. Necesitamos el ID del admin cloud. Vamos a buscarlo directo de la DB Cloud
    # IMPORTANTE: Debemos asegurarnos de estar conectando a Neon
    from app.config import settings
    # Forzar URL de Produccion si el entorno local no la tiene
    settings.DATABASE_URL = "postgresql://vantdomus_neon_owner:npg_g0vIfuVdC8bM@ep-divine-violet-a8z26v0u-pooler.eastus2.azure.neon.tech/vantdomus_neon?sslmode=require"
    
    conn = connect()
    cursor = conn.cursor()
    
    email = "cloud_admin@vantdomus.cl"
    new_password = "SecureRoot$2026"
    new_hash = hash_password(new_password)
    
    # Check si existe
    cursor.execute("SELECT id FROM persons WHERE email = %s", (email,))
    row = cursor.fetchone()
    
    if not row:
        print(f"ERROR: No se encontro el usuario {email} en la BD")
        return
        
    admin_id = row[0]
    print(f"Admin encontrado con ID: {admin_id}")
    
    # 2. Forzar actualizacion de hash
    print("Forzando actualizacion de hash en la BD...")
    cursor.execute("UPDATE persons SET password_hash = %s WHERE id = %s", (new_hash, admin_id))
    conn.commit()
    
    # 3. Generar un Token Fresco e Imprimirlo
    token, _ = create_access_token(sub=admin_id, email=email)
    
    print("\n--- REPARACION COMPLETADA ---")
    print(f"La contrasena para {email} fue restablecida exitosamente a: {new_password}")
    print("\nSi el login movil sigue fallando, usa directamente este Token:")
    print(token)

if __name__ == "__main__":
    fix_admin()
