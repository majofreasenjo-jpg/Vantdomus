# VantDomus Hogar — Demo Local (Sprint U1-LOCAL)

> Cómo levantar y recorrer en 3-5 minutos la experiencia de **VantDomus Hogar**
> con la familia curada **"Familia Demo VantDomus"** (Camila, Pedro, Diego,
> Sofía y Elena). Sin deploy público, sin secretos en docs, todo local.
>
> Commit base: `724af80` (en `main`). Tests: 63/63 verdes.

## 1. Levantar el backend
En PowerShell (carpeta del proyecto):
```
.\tools\windows\Run-API.ps1
```
- Arranca `uvicorn` en `http://127.0.0.1:8001`.
- Aplica todas las migraciones en SQLite local (`apps/api/vantdomus.db`).
- Las nuevas: `274_family_board`, `275_household_shopping`, `276_daily_activities`.

## 2. Levantar el frontend
En otra terminal:
```
.\tools\windows\Run-Web.ps1
```
- Next.js dev en `http://localhost:3000`.

## 3. Usuario demo
- Email: `manuel@vantdomus.local`
- Password: `Demo-Pass-2026!`
- MFA: vacío.
(Si no existe, registrarlo desde `/login`.)

## 4. Crear el hogar demo y sembrarlo (una sola vez)
1. Login en `http://localhost:3000/login`.
2. Desde el dashboard genérico (`/dashboard`), crear un hogar nuevo llamado
   **"Familia Demo VantDomus"** (o usar el botón "Cargar familia" si está visible).
3. Sembrar con el modo **v2** (POST autenticado al backend; ejemplo curl):
   ```
   POST /demo/seed?household_id=<HID>&mode=home_v2
   ```
   Esto crea:
   - 5 integrantes: **Camila (madre/coordinadora), Pedro (padre), Diego (hijo
     estudiante), Sofía (hija estudiante), Elena (abuela)**, sin duplicados.
   - 6 avisos del hogar (incluye fijados de salud y colegio).
   - 8 productos de compras (algunos ya "en carro").
   - 12 actividades del día (por integrante, incluyendo medicación de Elena).
   - 1 UnitFunction de medicación de Elena (continuidad VG+2).
   - Marca `industry_preset=family` para activar la UI familiar.
4. Anotá el `household_id` y abrí:
   ```
   http://localhost:3000/hogar/<HID>
   ```

## 5. Recorrido demo (3-5 minutos)
1. **Panel del Hogar** (`/hogar/<HID>`). Es el **home** principal en modo familia.
   - Domi narra el día: "Buenos días, Manuel. Hoy hay N cosas importantes...".
   - Avisos del hogar (con fijados).
   - "Hoy en la familia": actividades por integrante con hora.
   - "Compras del hogar" con carro tentativo y total estimado.
   - 4 accesos rápidos a Salud / Documentos / Presupuesto / Biblioteca.
2. **Avisos del hogar** (`/avisos/<HID>`): publicar uno nuevo. Marcar uno como
   resuelto o archivado.
3. **Compras del hogar** (`/compras/<HID>`): agregar un producto, moverlo "a carro",
   marcar uno como comprado.
4. **Documentos → Bandeja inteligente** (`/documents/<HID>`): pegar texto de
   receta o boleta y confirmar la propuesta (sigue el flujo VG+2.2).
5. **Biblioteca / Salud / Presupuesto**: navegación cálida coherente con el resto.

## 6. Qué es real (no prototipo)
- Tablas, endpoints CRUD, scoping por household, audit, idempotencia del seed.
- 3 módulos nuevos: **Family Board, Compras + Carro Tentativo, Actividades del Día**.
- Domi narrador con frases **server-side** generadas a partir de los datos reales
  (sin LLM ni IA externa).
- Pruebas: `tests/test_u1_local.py` (11/11 verdes) + suite anterior (63/63 totales).

## 7. Qué es preview o queda fuera de este sprint (honesto)
- **Sin push real, sin email/WhatsApp inbound, sin scheduler runtime**: los
  recordatorios automáticos llegarán en Sprint D.
- **Sin OCR de fotos**: la Bandeja Inteligente lee PDF y texto pegado; las
  fotos siguen como "pendiente de revisión manual" (igual que VG+2.2).
- **Sin checkout / sin precios reales / sin APIs externas / sin scraping**:
  el carro tentativo es solo organización. Disclaimer visible.
- **Sin ubicación/check-in voluntario**: difería para Fase 3 de VG+2.3.
- **Sin voz / sin Lottie/Rive**: Domi sigue como AssistantOrb CSS.
- **Sin IA plena**: `VANTDOMUS_AI_FEATURES_ENABLED=false` por defecto.
- **Sin deploy público**: este sprint es 100% local.

## 8. Limitaciones conocidas
- El frontend del Panel del Hogar consulta varios endpoints en paralelo; sin
  caché por ahora (revalidate=0). Aceptable en local; en deploy se evaluará caché.
- El navbar familia ahora apunta "Inicio" → `/hogar/<HID>`. `/dashboard/<HID>`
  sigue funcionando (no se rompió) pero es la vista B2B/operativa.
- El seed v2 sembra avisos con fechas relativas a "hoy"; si re-corres después de
  días, la narrativa sigue coherente pero las fechas concretas pueden notarse.

## 9. Próximo paso hacia web (después)
1. Sprint C — Deploy demo (Render + Vercel + SQLite/Disk). Ver
   `docs/DEPLOY_DEMO_RUNBOOK.md`.
2. Sprint VG+2.3 fase 3 — Check-in/ubicación voluntaria (opt-in, sin tracking
   continuo).
3. Sprint D — Runtime real (scheduler, push, email inbound).

## 10. Smoke local mínimo (21 puntos, versión local)
1. Backend `/health` 200. 2. Frontend `/login` 200. 3. Login funciona.
4. `/hogar/<HID>` carga con datos del seed v2. 5. Domi visible con narrativa.
6. Avisos del hogar carga. 7. Crear aviso funciona y refresca.
8. Marcar aviso resuelto/archivado funciona. 9. Compras carga.
10. Crear producto funciona. 11. Mover a carro funciona y aparece en el panel.
12. Marcar comprado funciona. 13. Carro tentativo agrupa por tienda y muestra
total estimado + disclaimer. 14. Actividades del día visibles por integrante.
15. Guía Familiar coherente. 16. Biblioteca coherente. 17. Documentos +
Bandeja Inteligente flujo de receta funciona. 18. Salud carga con empty state
útil. 19. Presupuesto carga. 20. No aparecen UUIDs visibles. 21. No aparece copy
B2B (Dirección Ejecutiva, ESG, Wealth Guard, "VantGuide" en family).

---

## CP1b Google Visual Port — companion-first Domi (2026-07-02)

La home `/hogar/[householdId]` ahora es el **port del prototipo aprobado de
Google AI Studio** (`vantdomus-hogar (6).zip`): Domi protagonista central con
órbitas y nodos, panel "Tu hogar hoy", cards principales, dock de voz y temas
por hora. Branch: `u1-cp1b-google-visual-port`.

### Cómo probar (local)
1. Arrancar API + web (`Iniciar_VantDomus.bat` o manual). Login demo habitual.
2. Abrir `http://localhost:3000/hogar/<householdId>`.

### Temas (auto por hora local; override por query)
- `?theme=dawn` · `?theme=day` · `?theme=sunset` · `?theme=night`
- Auto: 06-09 dawn · 09-18 day · 18-21 sunset · resto night.

### Estados de Domi (override por query)
`?domiState=` + `listo | escuchando | pensando | proponiendo |
esperando_confirmacion | protector | calma | cercano | alegre | descanso`
- Combinables: `?theme=day&domiState=pensando` · `?theme=sunset&domiState=alegre`

### Estado del gate visual (ChatGPT, 2026-07-03)
- **APROBADO como base visual de integración, condicionado.** El drift de grises
  (pills/nodos/botones) se corrigió: preflight de Tailwind *scoped* a
  `#vantdomus-app` + utilidades sin capa (commit `2cb92af`).
- **Referencia visual CONGELADA** = prototipo Google AI Studio. Claude queda como
  integrador del repo, no como diseñador. Cualquier cambio visual grande se
  detiene y se consulta.
- Estado base recomendado para comparar: `?theme=day` · `domiState=listo` (default)
  · `appearance=original` (default).

### Dev panel / Domi Lab (solo QA local)
- Oculto por defecto (`DEV_PANEL_ENABLED=false`). Verificado: sin `?dev=1` no hay
  ningún control de desarrollo en el DOM.
- Activar con `?dev=1` (o `Ctrl+Shift+D` una vez activo el modo dev).
- El disparador se rotula **"Domi Lab · QA (dev)"** — es una herramienta de QA
  visual (temas/estados/disfraces), **no** una función del usuario ni el futuro
  "Selector de Domi" (ese es feature aparte, aún en tokens).
- `?domiAppearance=` existe como arquitectura interna (no es feature visible).

### Real vs demo
- **Real:** integrantes (getDashboard→persons) y lista de compras
  (shoppingList) mapeados a los tipos del prototipo.
- **Demo (fallback del prototipo, marcado en código):** bloques de estudio,
  documentos del workspace, notificaciones, ambiente/temperatura, y el chat —
  que responde por REGLAS locales (`components/domi/domiIntents.ts`), sin red
  ni IA externa. Medicamentos NUNCA se auto-confirman desde el chat.
