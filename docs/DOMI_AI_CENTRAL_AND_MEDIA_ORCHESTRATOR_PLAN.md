# Domi — IA Central del Hogar y Media Orchestrator

**Estado:** DISEÑO / BACKLOG (design-only). Sin código funcional, sin OAuth, sin APIs musicales, sin secretos, sin deploy, sin tocar la home.
**Contexto:** ampliación formal de visión autorizada por el owner y ChatGPT durante MIN-3.3b (que sigue abierto, gateado por su llamada sintética real).
**Base:** arquitectura segura MIN-3.0 → 3.3b (`9467a52`).

**Frase de control:** *Domi no será un control remoto con chat; será la inteligencia central que comprende a la persona, coordina el hogar y usa música, voz, memoria y agentes como partes de una sola experiencia.*

---

## 1. Tesis central

1. **Domi es la interfaz inteligente central del hogar.** Todo pasa por Domi: conversación, organización, documentos, cuidado, multimedia.
2. **El usuario conversa con Domi**, nunca con módulos ni agentes separados. Una sola identidad, una sola voz, una sola experiencia.
3. **Domi delega internamente** en agentes especialistas (hogar, documentos, estudio, salud, finanzas, compras, multimedia, rutinas, compañía) y devuelve una respuesta unificada.
4. **Música y multimedia son capacidades contextuales de Domi**, no un módulo aislado: sirven a la compañía, el descanso, el estudio, las rutinas y la convivencia.
5. **La música puede apoyar experiencias** ("me siento un poco sola" → conversación + música tranquila; "activa mi rutina de estudio" → música instrumental + temporizador + tarea prioritaria), siempre dentro de permisos.
6. **Nunca se presenta como tratamiento médico.** La música/sonido acompaña; no diagnostica, no trata, no promete efectos clínicos. Sin claims "terapéuticos" ni "binaural" con promesas de salud.

## 2. Mapa de inteligencia central

```
Domi (identidad única, experiencia unificada)
├── Conversation Orchestrator     ← diálogo multi-turno, aclaraciones, intención compuesta
├── Memory Service                ← memoria AUTORIZADA (ver Capa 4 del backlog)
├── Context Builder               ← contexto mínimo scoped/redactado (ya existe, MIN-3.3a)
├── Permission & Consent Gate     ← rol + módulo + consent (ya existe)
├── Provider Gateway              ← propose-only, schema estricto, fallback (ya existe)
├── Tool Registry                 ← contratos explícitos (ya existe)
├── Proposal Lifecycle            ← pending/confirm/reject/expire/failed (ya existe)
├── Audit & Evidence              ← auditoría sin secretos (ya existe)
└── Specialist Agents (internos, NUNCA expuestos como bots)
    ├── hogar          (avisos, actividades, estados)
    ├── documentos     (Bandeja Inteligente, boletas, circulares)
    ├── estudio        (tareas, planes, sesiones)
    ├── salud/cuidado  (recordatorios; confirmación humana SIEMPRE)
    ├── finanzas       (gastos, presupuesto; confirmación humana)
    ├── compras        (lista, carro, dedupe)
    ├── multimedia     (Media Orchestrator, §3)
    ├── rutinas        (composición de acciones: estudio, cena, descanso)
    └── compañía       (conversación cotidiana, senior; límites §8)
```

**Regla de identidad:** los agentes son *organización interna del código*, no personajes. El usuario jamás ve "el agente financiero"; ve a Domi. Domi mantiene tono, memoria de conversación y responsabilidad únicos.

## 3. Media Orchestrator neutral

**Principio:** no construimos "un agente que hace clic" en Spotify o YouTube. Construimos una **capa neutral de proveedores** con mecanismos oficiales (API + OAuth + scopes), donde cada adapter declara lo que SÍ puede hacer y el orquestador **nunca inventa soporte**.

```
Usuario ─ voz/texto → Domi → Intent Router → Media Orchestrator
    ├── VantDomus Ambient Audio      (propio/licenciado — PRIMER proveedor)
    ├── Spotify Adapter              (según API/políticas vigentes)
    ├── YouTube Adapter              (reproducción embebida oficial)
    ├── YouTube Music                (deep link / mecanismos permitidos)
    ├── Apple Music Adapter          (MusicKit según disponibilidad)
    ├── Amazon Music                 (adapter o handoff, según integración real)
    ├── Radio / Podcasts             (streams públicos/licenciados)
    └── Biblioteca local autorizada  (archivos del hogar)
         ↓
    Dispositivo autorizado (§7)
```

### Contratos conceptuales

| Contrato | Responsabilidad |
|---|---|
| `MediaOrchestrator` | Punto único: resuelve intención → proveedor → dispositivo → nivel de integración → acción o propuesta. |
| `MediaProviderAdapter` | Un proveedor. Declara `capabilities()` reales y su `IntegrationLevel` por operación. Nunca simula. |
| `MediaCapability` | Una operación del catálogo (`media.play`, `media.search`, …) con input/output schema. |
| `MediaIntent` | Intención normalizada del usuario (quién, qué, dónde, cuánto tiempo, condiciones). |
| `MediaTarget` | Qué reproducir: track/playlist/álbum/artista/género/mood/ambient. |
| `MediaSession` | Estado de reproducción activo (proveedor, dispositivo, quién la inició, timer). |
| `MediaConsent` | Qué conexión de qué integrante puede usarse, por quién, dónde (§6/§8). |
| `MediaDevice` | Destino físico/lógico (§7). |
| `MediaResult` | Resultado honesto: ejecutado / propuesta / handoff / alternativa / no disponible. |

### Catálogo de capacidades (contrato neutral)

`media.search` · `media.play` · `media.pause` · `media.resume` · `media.stop` · `media.next` · `media.previous` · `media.seek` · `media.set_volume` · `media.adjust_volume` · `media.play_playlist` · `media.play_album` · `media.play_artist` · `media.play_genre` · `media.play_mood` · `media.play_ambient_sound` · `media.set_sleep_timer` · `media.transfer_device` · `media.get_current_playback` · `media.like` · `media.add_to_playlist`

**No todas estarán disponibles en todos los servicios.** El adapter declara; el orquestador consulta capacidades declaradas y, si falta, ofrece la mejor alternativa del nivel inferior (§4) explicándolo al usuario.

## 4. Niveles de integración

| Nivel | Significado | Ejemplo |
|---|---|---|
| `FULL_CONTROL` | Control completo autorizado por API oficial. | Ambient Audio propio; Spotify si el plan/API vigente lo permite. |
| `EMBEDDED_PLAYBACK` | Reproducción dentro de un reproductor oficial embebido. | YouTube IFrame Player. |
| `DEVICE_HANDOFF` | Abrir/transferir la reproducción a la app del proveedor. | Deep link a YouTube Music / Amazon Music. |
| `SEARCH_AND_SUGGEST` | Buscar, sugerir y mostrar opciones; no reproducir directo. | Catálogos sin API de playback. |
| `UNAVAILABLE` | Proveedor conectado pero la operación pedida no está permitida. | `media.seek` donde la API no lo expone. |

**Reglas:** cada adapter declara su nivel POR OPERACIÓN; los niveles pueden degradarse cuando el proveedor cambie políticas (Spotify ya restringió capacidades a apps nuevas — la arquitectura asume inestabilidad contractual); el orquestador comunica el nivel con honestidad ("Spotify no me deja hacer eso directamente; te lo abro en su app").

## 5. Proveedores (adapters futuros)

1. **VantDomus Ambient Audio** — primero: valida TODA la UX (intents, timer, fade, dispositivos, consent) sin dependencia externa.
2. **Spotify** — mediante el mecanismo oficialmente permitido al momento de implementar (revisión fresca de la API obligatoria).
3. **YouTube** — reproducción embebida oficial (IFrame/API), sin descargas.
4. **YouTube Music** — deep link / mecanismos permitidos.
5. **Apple Music** — MusicKit según disponibilidad para apps independientes.
6. **Amazon Music** — adapter o handoff según integración real disponible.
7. **Radio/Podcasts** — streams públicos o licenciados.
8. **Biblioteca local autorizada** — archivos del hogar.

**Prohibiciones absolutas:** scraping · browser automation · evasión de DRM · uso indebido de cuentas compartidas · asumir acceso permanente a APIs de terceros.

## 6. Identidad y OAuth (diseño)

- **Una conexión por usuario y proveedor** (Manuel→Spotify, Camila→YouTube, Elena→ambient+radio…).
- **Scopes mínimos** necesarios para las capacidades declaradas, nada más.
- **Tokens cifrados** en reposo; **nunca contraseñas** del servicio musical.
- **Rotación, expiración y revocación** registradas; revocar = borrar tokens + auditar.
- **Auditoría** de conexión/uso/revocación.
- **Visibilidad:** el usuario siempre puede ver qué cuenta está activa y dónde suena.
- **Permisos de uso familiar:** usar la conexión de OTRO integrante requiere permiso explícito de ese integrante (consent registrado); jamás compartir silenciosamente.
- Registro por conexión: proveedor, scopes, identificador cifrado, fecha de autorización, expiración, dispositivos disponibles, preferencias, quién puede usarla, revocaciones.
- **Migración de DB:** NO se crea en este checkpoint; el diseño no la exige hasta MIN-5.0 (la tabla `media_connections` se especificará ahí).

## 7. Selección de dispositivo (modelo conceptual)

Destinos: este navegador · teléfono · computador · televisor · altavoz · dispositivo del proveedor (Connect) · Chromecast/AirPlay cuando exista soporte oficial · **dispositivo predeterminado por persona/espacio**.

El usuario puede preguntar/ordenar: *"¿Dónde se está reproduciendo?"* · *"Pásalo al living."* · *"Baja el volumen del dormitorio."*

Resolución: intención → dispositivo explícito > predeterminado del espacio > predeterminado de la persona > preguntar. Controlar el espacio privado de OTRO integrante requiere confirmación (§8).

## 8. Consentimiento y seguridad (clasificación de acciones)

| Clase | Acciones | Tratamiento |
|---|---|---|
| **Read** | buscar; consultar reproducción; consultar dispositivos | directas, scoped |
| **Immediate reversible** | play, pause, next, volume (en dispositivo propio/común) | directas, auditadas, reversibles |
| **Confirmation-required** | modificar playlists; conectar/desconectar cuentas; usar cuenta de otro integrante; reproducir en espacio privado ajeno; rutinas que combinen otros dispositivos | propuesta → confirmación humana (mismo lifecycle MIN-3.2) |
| **Prohibited** | compras de suscripciones; cambios de plan; reproducción oculta; grabación ambiental; acceso a historial de otro integrante sin permiso; elusión de restricciones del proveedor | bloqueadas en registry (patrón BLOCKED_TOOLS) |

**Nota canónica:** esto extiende el modelo existente (tools read/write + sensibles + BLOCKED) — la música entra al MISMO régimen de seguridad del orquestador, no a uno nuevo.

## 9. Escenarios prioritarios (flujos documentados)

1. **"Pon música tranquila."** → identificar hablante → proveedor autorizado → mood=calm → nivel de integración → play o propuesta/handoff.
2. **"Continúa mi playlist."** → sesión previa o playlist reciente del hablante → resume/play.
3. **"Pon música para estudiar 45 minutos."** → mood=focus + `set_sleep_timer(45m)` + (rutina estudio si está autorizada).
4. **"Pon sonidos de lluvia y apágalos en 20 minutos."** → Ambient Audio → rain + timer + fade-out.
5. **"Pon la música que le gusta a Elena."** → preferencias de Elena (memoria autorizada) → SU proveedor si dio permiso de uso; si no, alternativa neutral (ambient/radio) + explicación.
6. **"Pasa la música al living."** → `transfer_device` si el nivel lo permite; si no, handoff honesto.
7. **"Baja el volumen."** → sesión activa → `adjust_volume(-)` (reversible, directa).
8. **"No uses YouTube; usa Spotify."** → preferencia de proveedor por persona (memoria autorizada) + cambio de sesión.
9. **Sin servicios conectados** → ofrecer Ambient Audio/radio + explicar cómo conectar cuentas (nunca pedir contraseñas).
10. **Proveedor sin control directo** → declarar nivel real → SEARCH_AND_SUGGEST o DEVICE_HANDOFF con copy honesto.
11. **Token expirado** → no fallar en silencio: avisar, ofrecer re-autorizar (OAuth), degradar a alternativa.
12. **Dispositivo no disponible** → informar + ofrecer dispositivo alternativo o este navegador.
13. **Menor intenta usar cuenta restringida** → Permission Gate bloquea; propone alternativa permitida; opcional aviso al responsable.
14. **Integrante intenta controlar dormitorio ajeno** → confirmación del dueño del espacio (confirmation-required).
15. **Rutina senior de calma y compañía** → *"me siento un poco sola"* → Domi conversa Y ofrece (no impone) música tranquila conocida; volumen seguro; escalamiento humano si detecta malestar sostenido (§ Capa 7; sin diagnóstico).

## 10. VantDomus Ambient Audio (primer proveedor controlable)

- **Catálogo:** lluvia · bosque · mar · ruido blanco · ambiente suave · sonidos de descanso.
- **Controles:** timer (sleep) · fade-in/fade-out · **volumen seguro** (tope por defecto, pensado en seniors y niños) · loop sin cortes.
- **Reproducción:** local en el dispositivo o assets licenciados servidos por VantDomus.
- **Por qué primero:** valida el 100% del contrato (intents, niveles, dispositivos, timers, consent, UI) con CERO dependencia externa, cero OAuth, cero políticas de terceros.
- **Límites:** este checkpoint NO incluye archivos de audio; NO se afirma efecto terapéutico; NO se usa "binaural" con promesas clínicas. Copy estilo: *"sonidos para acompañar el descanso"*, nunca *"tratamiento del insomnio"*.

## 11. Backlog de IA central pendiente

| Área | Pendiente |
|---|---|
| Conversación | multi-turno con contexto; aclaraciones cuando falta información; intenciones compuestas ("apaga la música y recuérdame la prueba de Diego"); razonamiento sobre tools disponibles; explicación de por qué recomienda algo |
| Memoria autorizada | preferencias; personas/relaciones; rutinas; hechos familiares; compromisos; contexto temporal; gustos musicales; accesibilidad; conversaciones relevantes; instrucciones persistentes. **Toda memoria muestra:** qué recuerda · por qué · quién puede verlo · quién lo autorizó · cómo corregirlo · cómo borrarlo |
| Voz | push-to-talk primero: captura → STT → comprensión → propuesta/respuesta → TTS voz de Domi → interrupción y continuación. Wake word permanente = fase posterior (privacidad, batería, hardware) |
| Compañía senior | saludo personalizado; conversación cotidiana; detección PRUDENTE de aislamiento/malestar; música y ambiente; mensajes a familiares; recordatorios; actividad cognitiva; historias/recuerdos; **escalamiento humano**; límite explícito: no sustituye atención profesional |
| Documentos/conocimiento | PDF, imágenes, boletas, enlaces permitidos, circulares, documentos académicos, medicamentos, instrucciones; extracción con evidencia; citas; detección de contradicciones; planes de estudio con seguimiento |
| Rutinas | composición segura de acciones multi-dispositivo (estudio, cena, descanso) con confirmación |
| Hogar conectado | TV, altavoces, Chromecast/AirPlay oficiales, iluminación, escenas, temporizadores |
| Gobernanza | controles parentales; accesibilidad senior (texto, voz, volumen seguro); escalamiento humano |

## 12. Roadmap propuesto

```
MIN-3.3b  Cierre del shadow externo sintético            ← GATE ACTUAL (abierto)
MIN-3.4   IA conversacional real propose-only, contexto familiar mínimo y controlado
MIN-3.5   Memoria autorizada v1 (ver/corregir/borrar; consent explícito)
MIN-4.0   Voz push-to-talk + TTS de Domi
MIN-4.1   Compañía senior v1
MIN-5.0   Media Orchestrator neutral + Mock/Ambient provider (sin terceros)
MIN-5.1   Primer proveedor musical real (según §13, revisión fresca)
MIN-5.2   Sonidos ambientales avanzados + rutinas multimedia
MIN-5.3   Segundo proveedor + device handoff
```

**Disciplina:** la música se DISEÑA ahora, pero no interrumpe MIN-3.3b ni abre múltiples integraciones simultáneas. Un gate por vez, con cierre formal y respaldo.

## 13. Criterios para elegir el primer proveedor real (matriz de evaluación)

Comparar al momento de MIN-5.1 (con documentación oficial FRESCA, nunca de memoria):

API oficial pública · OAuth disponible para apps independientes · control de playback real (no solo metadata) · búsqueda · disponibilidad regional (Chile) · restricciones por plan (free vs premium) · dispositivos soportados · SDK web/mobile · proceso de revisión/aprobación de apps · cuotas y rate limits · política de privacidad y datos · **estabilidad contractual** (historial de cambios de política) · costo · experiencia de fallback cuando la API se degrade.

**Orden tentativo (a revalidar):** 1) Ambient propio → 2) Spotify o YouTube por mecanismo oficial vigente → 3) Apple Music → 4) Amazon Music según disponibilidad real. **No se selecciona proveedor definitivo sin revisión actualizada de su documentación.**

## 14. Riesgos principales

1. **Políticas de terceros cambiantes** (Spotify ya restringió API a apps nuevas) → mitigación: niveles de integración degradables + Ambient propio como base inquebrantable.
2. **Privacidad de cuentas familiares** → mitigación: una conexión por persona, consent explícito de uso cruzado, visibilidad total, cero passwords.
3. **Scope creep** (música arrastrando domótica/voz antes de tiempo) → mitigación: roadmap gateado, un proveedor por checkpoint.
4. **Expectativas tipo Alexa** (usuario espera todo, ya) → mitigación: honestidad de niveles ("te lo abro en su app") y copy claro.
5. **Sobre-promesa de bienestar** → mitigación: prohibido copy clínico/terapéutico; compañía ≠ tratamiento.
6. **Costos/quotas de APIs** → mitigación: presupuesto por proveedor + circuit breaker ya existente en el gateway.

---

*Documento de diseño; no implementa nada. El código llegará gate a gate según el roadmap §12, cada uno con autorización, evidencia y respaldo.*
