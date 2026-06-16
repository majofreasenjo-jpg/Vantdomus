import shutil
import os
from datetime import datetime

backup_name = f"VantDomus_Antucoya_Backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
backup_path = os.path.join("backups", backup_name)

# Asegurarse que la carpeta "backups" existe
os.makedirs("backups", exist_ok=True)

# Lista de carpetas a incluir
folders_to_backup = [
    "vantdomus_core",
    "vantdomus_panel",
    "vantdomus_mobile",
    "Antucoya"
]

print(f"Iniciando respaldo en: {backup_path}.zip")

# Podríamos usar shutil.make_archive pero queremos excluir `node_modules` y `__pycache__`
import zipfile

def is_excluded(path):
    exclusions = ['node_modules', '__pycache__', '.git', '.expo']
    for ex in exclusions:
        if ex in path:
            return True
    if path.endswith('.db-journal'):
            return True
    return False

with zipfile.ZipFile(f"{backup_path}.zip", 'w', zipfile.ZIP_DEFLATED) as zipf:
    for folder in folders_to_backup:
        if os.path.exists(folder):
            for root, dirs, files in os.walk(folder):
                if is_excluded(root):
                    continue
                for file in files:
                    file_path = os.path.join(root, file)
                    if not is_excluded(file_path):
                        arcname = os.path.relpath(file_path, start=os.path.curdir)
                        zipf.write(file_path, arcname)

print("Respaldo completado exitosamente.")
