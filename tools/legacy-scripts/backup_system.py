import os
import zipfile
import datetime

source_dir = r"D:\Aplicaciones de Juegos\VantDomus"
backup_dir = r"D:\Aplicaciones de Juegos\Backups"

if not os.path.exists(backup_dir):
    os.makedirs(backup_dir)

timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
zip_filename = f"VantDomus_Backup_{timestamp}.zip"
zip_filepath = os.path.join(backup_dir, zip_filename)

exclude_dirs = {"node_modules", ".next", "__pycache__", ".venv"}

def create_backup():
    total_files = 0
    with zipfile.ZipFile(zip_filepath, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, start=os.path.dirname(source_dir))
                zipf.write(file_path, arcname)
                total_files += 1
    print(f"Respaldo creado exitosamente: {zip_filepath}")
    print(f"Total de archivos respaldados: {total_files}")

if __name__ == "__main__":
    create_backup()
