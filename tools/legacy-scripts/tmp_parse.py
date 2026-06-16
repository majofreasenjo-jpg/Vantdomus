import os
import pymupdf
import docx2txt

base_dir = r"D:\Aplicaciones de Juegos\VantDomus\Antucoya\Contrato Puma"
pdf_path = os.path.join(base_dir, "Programa Actividades Contrato 724 PUMA_rev31marzo.pdf")
doc_path = os.path.join(base_dir, "SECUENCIA.docx")

output_txt = r"D:\Aplicaciones de Juegos\VantDomus\tmp_parse.txt"

with open(output_txt, "w", encoding="utf-8") as out:
    out.write("==== SECUENCIA.docx ====\n\n")
    if os.path.exists(doc_path):
        text = docx2txt.process(doc_path)
        out.write(text)
    else:
        out.write("File not found.")
        
    out.write("\n\n==== Programa Actividades (PDF) ====\n\n")
    if os.path.exists(pdf_path):
        doc = pymupdf.open(pdf_path)
        for page in doc:
            out.write(page.get_text())
    else:
        out.write("File not found.")

print("Done parsing.")
