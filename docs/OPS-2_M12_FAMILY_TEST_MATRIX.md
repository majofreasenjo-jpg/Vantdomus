# OPS-2 M12 — Matriz de prueba familiar (dispositivos reales)

> **Qué es esto.** El protocolo de prueba REAL que se ejecuta en los dispositivos
> de la casa ANTES de invitar a la familia. Es el instrumento de la regla del
> canon: *ninguna capacidad se declara COMPLETA sin prueba funcional real*.
> El código puede estar verde en tests; esto verifica que funciona EN TUS MANOS.
>
> **Cómo usarla.** Ejecuta los casos en orden por prioridad (P0 → P1 → P2) en
> cada dispositivo de la columna. Marca ✅ PASS / ❌ FAIL / ➖ N/A. Un FAIL en P0
> o P1 = detente y repórtalo antes de seguir.

## 0. Preparación (una sola vez)

| # | Paso | Hecho |
|---|---|---|
| P-1 | Render **Live** en el último commit (`ba4fb17` o posterior) y Vercel **Ready** en el mismo | ☐ |
| P-2 | Sesión master de Manuel funcionando (`/login`) | ☐ |
| P-3 | Crear **2 cuentas sintéticas** vía invitación (ej. "Prueba Adulto B" member y "Prueba Menor" con tutela) — necesarias para los casos de privacidad. NO usar nombres reales de la familia | ☐ |
| P-4 | Dispositivos listos: **Android** (Chrome), **iPhone** (Safari), **PC** (Edge/Chrome) | ☐ |
| P-5 | Anotar qué infra opcional está activa: push VAPID ☐ · antivirus ClamAV ☐ (si están apagadas, los casos marcados ⚙ se saltan como N/A) | ☐ |

**Convención de resultados por caso:** `A` = Android · `i` = iPhone · `P` = PC.

---

## 1. P0 — BLOQUEANTES (canon: sin esto NO se invita a la familia)

### 1.1 Aislamiento LIVE/TEST (M2)

| ID | Caso | Pasos | Esperado | A | i | P |
|---|---|---|---|---|---|---|
| T-01 | Sin datos demo | Entrar a la home con el master | NO aparecen Elena/Diego ni compras de ejemplo; pantalla limpia con datos reales | | | |
| T-02 | Inventario limpio | (Render Shell) `python scripts/db_admin.py inventory` | Las cuentas sintéticas de prueba salen marcadas SINTÉTICO; ninguna real mezclada | ➖ | ➖ | |
| T-03 | Snapshot | (Render Shell) `python scripts/db_admin.py snapshot` | Crea backup en /data/backups sin error | ➖ | ➖ | |

### 1.2 Privacidad de memoria (M1) — requiere 2 cuentas

| ID | Caso | Pasos | Esperado | A | i | P |
|---|---|---|---|---|---|---|
| T-04 | Memoria privada invisible | Con cuenta B crear en /perfiles una memoria "Privada (solo tú y Domi)" con texto único (ej. "secreto B7"). Cerrar sesión, entrar con master | El master NO ve "secreto B7" en la lista ni en la Biblioteca | | | |
| T-05 | Domi no la revela | Con el master, preguntar a Domi por esa persona / pedir resumen | La respuesta y el resumen NUNCA mencionan "secreto B7" | | | |
| T-06 | Compartida sí visible | Con cuenta B crear memoria "Compartida con la familia" ("pizza los viernes") | El master SÍ la ve; Domi puede usarla | | | |
| T-07 | Borrar = olvidar | Borrar una memoria propia; preguntar a Domi algo relacionado | Ya no aparece en lista ni en respuestas | | | |

### 1.3 Acceso y sesión

| ID | Caso | Pasos | Esperado | A | i | P |
|---|---|---|---|---|---|---|
| T-08 | Registro cerrado | En ventana incógnito ir a /login → intentar registrarse | No existe registro abierto; solo login e invitación | | | |
| T-09 | Invitación completa | Generar invitación para cuenta B, abrir el link en otro dispositivo, aceptar | Alta correcta, entra a SU vista, no a la del master | | | |
| T-10 | Logout | Cerrar sesión | Vuelve a /login; atrás no recupera la sesión | | | |

---

## 2. P1 — Valor central (lo que la familia va a usar el día 1)

### 2.1 Instalación PWA

| ID | Caso | Pasos | Esperado | A | i | P |
|---|---|---|---|---|---|---|
| T-11 | Instalar | Android: menú Chrome → "Agregar a pantalla de inicio". iPhone: Compartir → "Agregar a inicio" | Icono de Domi en el inicio; abre standalone (sin barra del navegador) | | | ➖ |
| T-12 | Sesión en PWA | Abrir desde el icono ya logueado | Mantiene sesión; no pide login de nuevo | | | ➖ |

### 2.2 Domi chat + IA real

| ID | Caso | Pasos | Esperado | A | i | P |
|---|---|---|---|---|---|---|
| T-13 | Chat responde real | Preguntar algo del hogar ("¿qué compras faltan?") | Respuesta coherente con TUS datos (no genérica de demo) | | | |
| T-14 | Propose-first | Pedir "agrega pan a compras" | Domi PROPONE; nada se crea hasta tocar Confirmar; al confirmar aparece en Compras | | | |
| T-15 | Tipo de respuesta | Observar el chip sobre la respuesta | Chip correcto (información/propuesta/acción ejecutada) | | | |
| T-16 | Resumen del día (M6) | Botón "📋 Mi resumen del día" | Resumen personal con tus tareas/compras/avisos; sin datos privados de otros | | | |

### 2.3 Voz (M4)

| ID | Caso | Pasos | Esperado | A | i | P |
|---|---|---|---|---|---|---|
| T-17 | Dictar 🎤 | Tocar mic, permitir micrófono, dictar frase | El texto transcrito aparece en el input para REVISAR antes de enviar | | | |
| T-18 | Leer en voz alta 🔊 | Activar el toggle y enviar un mensaje | Domi lee la respuesta; se puede desactivar | | | |
| T-19 | Senior lee por defecto | Cambiar a modo Senior y chatear | Lectura en voz alta activada por defecto | | | |

### 2.4 Recordatorios (M7.A) + Calendario (M11)

| ID | Caso | Pasos | Esperado | A | i | P |
|---|---|---|---|---|---|---|
| T-20 | Crear y vencer | En /recordatorios crear "prueba T20" con fecha exacta 2 min en el futuro; esperar y refrescar | Aparece en "🔔 Para ti ahora"; "Listo ✓" lo descarta y no vuelve | | | |
| T-21 | Privado invisible | Con cuenta B crear recordatorio "Solo para mí"; mirar con master | El master no lo ve en su campana | | | |
| T-22 | Calendario mensual | En /actividades crear evento con hora mañana; mirar la grilla | El día muestra punto; al tocarlo, el detalle lista el evento | | | |
| T-23 | Aviso antes del evento | Crear evento con "Avisar 15 min antes" | Se crea el recordatorio vinculado (visible en /recordatorios programados) | | | |
| T-24 | Export .ics | Botón "⬇ .ics" y abrir el archivo en Google/Apple Calendar | Importa los eventos correctos (y NO los privados de otros) | | | |
| T-25 ⚙ | Push real (M7.B) | Con VAPID+Cron activos: "Activar avisos", crear recordatorio 2 min, CERRAR la app | Notificación del sistema llega con la app cerrada; al tocarla abre /recordatorios | | | |

### 2.5 Modos (M5)

| ID | Caso | Pasos | Esperado | A | i | P |
|---|---|---|---|---|---|---|
| T-26 | Cambiar modo | Selector de modo → Senior | Letra grande, botones ≥48px, menos densidad; persiste al recargar | | | |
| T-27 | Noche/Calma | Probar ambos | Cambio visual coherente; volver a Clásico restaura | | | |

---

## 3. P2 — Valor extendido

### 3.1 Memoria: Biblioteca e inferencias (M8)

| ID | Caso | Pasos | Esperado | A | i | P |
|---|---|---|---|---|---|---|
| T-28 | Biblioteca por capas | /perfiles → "📚 Lo que Domi sabe" | Memorias agrupadas (personal/familiar/…); las privadas de otros NO están | | | |
| T-29 | Corregir | Botón "Corregir" en una memoria propia, editar y guardar | El texto queda actualizado | | | |
| T-30 | Exportar | "⬇ Exportar" | Descarga JSON solo con lo que TU cuenta puede ver | | | |
| T-31 | Inferencia no es hecho | Crear inferencia de prueba (o cuando Domi proponga): aparece "💡 Domi ha notado…" | ANTES de confirmar, Domi no la usa; tras "Sí, recuérdalo", sí | | | |

### 3.2 Documentos (M9) + Estudio

| ID | Caso | Pasos | Esperado | A | i | P |
|---|---|---|---|---|---|---|
| T-32 | Subir documento | /documents → subir un PDF | Aparece con huella #sha, badge "sin escanear" (o "✓ Limpio" si hay AV) | | | |
| T-33 | Nueva versión | "Nueva versión" y subir otro archivo | v2 reemplaza a v1; v1 desaparece de la lista viva | | | |
| T-34 | Privado invisible | Con cuenta B subir doc "Privado (solo mío)"; mirar con master | El master no lo ve | | | |
| T-35 | Duplicado | Subir el MISMO archivo dos veces | Mensaje "ya estaba registrado (misma huella)"; no se duplica | | | |
| T-36 ⚙ | Antivirus | Con ClamAV activo: subir archivo de prueba EICAR | Badge "⚠ Infectado" + 🔒 (cuarentena) | | | |
| T-37 | OCR + Bandeja | Subir foto de una boleta/receta en la Bandeja | Extrae texto y PROPONE ruta; nada se crea sin confirmar | | | |
| T-38 | Plan de estudio | Crear plan de estudio con la IA real | Pasos a la medida del aviso (no plantilla genérica); requiere confirmación | | | |

### 3.3 Música (M10) + Compras/Mural

| ID | Caso | Pasos | Esperado | A | i | P |
|---|---|---|---|---|---|---|
| T-39 | Guardar música | /musica → pegar link real de Spotify o YouTube + momento | Queda en la lista con icono del servicio | | | |
| T-40 | Link no musical | Pegar un link de cualquier otro sitio | Se RECHAZA con mensaje claro | | | |
| T-41 | Abrir | "▶ Abrir" | Abre la app/pestaña del servicio; nada se reproduce solo | | | |
| T-42 | Compras E2E | Agregar item, marcarlo comprado | Conteos coherentes en home/compras | | | |
| T-43 | Mural | Publicar aviso, comentar y reaccionar con la otra cuenta | Ambas cuentas ven la conversación | | | |

### 3.4 Seguridad periférica

| ID | Caso | Pasos | Esperado | A | i | P |
|---|---|---|---|---|---|---|
| T-44 | Superficie enterprise cerrada | Con cuenta B intentar URLs directas: /dashboard técnico, /esg B2B, rutas de settings avanzados | Denegado o redirigido; sin datos técnicos expuestos | | | |
| T-45 | Salud/finanzas cerradas | Verificar que los módulos sensibles no ofrecen funciones no habilitadas del perfil | Cerrado según family-live | | | |
| T-46 | Noindex | Ver código fuente de /login: `X-Robots-Tag`/meta noindex | Presente | ➖ | ➖ | |

---

## 4. Criterio GO / NO-GO para invitar a la familia

**GO si y solo si:**
1. **Todos los P0 (T-01…T-10) PASS en los 3 dispositivos** (los ➖ no cuentan).
2. **P1 (T-11…T-27) PASS** en al menos Android + iPhone (los ⚙ opcionales pueden quedar N/A si la infra está apagada — pero entonces la familia NO recibe push y hay que decírselo).
3. De P2, sin FAILs en privacidad (T-28, T-30, T-34).
4. Backup reciente hecho (T-03) y rollback conocido (repuntar branch/commit en Render/Vercel).

**Cualquier FAIL de privacidad (T-04..T-07, T-21, T-24, T-28, T-30, T-34) es NO-GO automático** aunque todo lo demás pase — es la brecha que el canon marca como bloqueante.

## 5. Registro de ejecución

| Fecha | Dispositivo | Ejecutor | Casos corridos | FAILs | Notas |
|---|---|---|---|---|---|
| | | | | | |
| | | | | | |

> Al terminar: reportar los FAIL con su ID (ej. "T-21 falla en iPhone: veo el
> recordatorio privado de B") — cada FAIL se convierte en un fix puntual antes
> del GO.
