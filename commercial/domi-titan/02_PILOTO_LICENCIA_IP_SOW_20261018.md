# DOMI TITAN — propuesta de engagement, SOW piloto y licenciamiento (interno)
18 oct 2026 · V1 · NO ENVIAR SIN APROBACIÓN

## Oferta escalonada — decisiones a negociar
**Etapa 0 — Discovery técnico (30 min, no vinculante):** definir problema OEM, superficies objetivo, modelo de IA existente, requisitos privacy y sponsor. Compartir sólo resumen no confidencial.
**Etapa 1 — Evaluación acotada con datos sintéticos:** 2–4 semanas **estimación de planificación, no promesa ni cotización**; threat model, baseline, selección de dos o tres tests K1–K4 y definición de aceptación/fracaso. No acceso a PII, firmware, secretos ni infraestructura OEM en esta etapa.
**Etapa 2 — Piloto de codesarrollo pagado:** SOW formal con hitos por evidencia: contrato de integración → K1 provider exit → K2 tres superficies → K3 procedencia y revocación → K4 memoria != autoridad, reporte comparativo y plan de rollback. Duración/plazo dependen de recursos y due diligence.
**Etapa 3 — Licencia condicionada y separada:** licencia SDK/runtime, royalties por dispositivo/usuario activo o tarifa por volumen, soporte e integración adicional sólo si pilotos son aceptados.

## Hipótesis económicas — no precios de mercado validados
- Etapa 0: reunión exploratoria sin obligación de compra.
- Etapa 1: evaluación pagada o conjunta; precio **A COTIZAR** tras discovery.
- Etapa 2: **fee inicial de integración + hitos de aceptación + soporte**; USD/UF/CLP y condiciones por negociar, sin inventar valor.
- Etapa 3: mínimo anual + tarifa por unidad activa **o** licencia corporativa pactada; exclusividad y field-of-use solo con remuneración específica y aceptación expresa.
No afirmar precios aprobados ni sugerir que exista presupuesto del OEM.

## Cláusulas base para negociar (no asesoría jurídica ni contrato)
1. Background IP de DOMI/CCI/DSR, métodos de investigación y código preexistente permanecen con su titular legítimo; confirmar cadena de titularidad antes de firmar.
2. Foreground IP: distinguir adaptadores de cliente y mejoras generales del core; negociación explícita antes de crear IP conjunta. Ninguna cesión tácita.
3. **No exclusividad por defecto**; sin derecho a sublicenciar código fuente ni crear derivados irrestrictos.
4. **Datos**: OEM controla sus datos; DOMI no recibe datos familiares VANTDOMUS ni se mezclan tenants; synthetic-first, minimización, revocación y eliminación verificable.
5. Licencia de evaluación no concede producción; despliegue productivo requiere aprobación de seguridad, privacidad, regulación y SLAs separados.
6. Evidencia: métricas preregistradas, casos negativos, logs sanitizados y posibilidad de fallar sin maquillajes; claims limitados a resultados observados.
7. Responsabilidad, indemnidades, export controls, patentes, ley aplicable, confidencialidad y jurisdicción requieren revisión especializada por país.
8. Todo envío, NDA, demo externa, API key, despliegue, pago o firma necesita autorización explícita del titular.

## SOW candidato — criterios de aceptación
| Gate | Demostración | Evidencia / rechazo |
|---|---|---|
| S0 | inventario de modelo/proveedor, dispositivo y superficie | architecture diagram firmado por ambas partes; no PII |
| S1 | dos historias sintéticas y comparativa simple-memory | replay determinista, trazabilidad, falsadores y baseline |
| S2 | K1 cambio de proveedor | continuidad declarada; si hay pérdida, reportarla y contabilizar |
| S3 | K2 móvil→TV compartida→auto simulado | cero filtración en conjunto de pruebas, scopes mínimos, receipts |
| S4 | K3 procedencia, corrección, revocación | memory authority y expiración controladas |
| S5 | K4 memory poisoning no fabrica permiso | test adversarial negativo; cualquier bypass = rechazo |
| S6 | handover OEM | integración mínima, rollback, costos de operación, threat model y evidencia |

**Terminación:** los criterios insatisfechos no se convierten en PASS por documentación; decidir reparar, reducir alcance o cancelar sin despliegue.

## Parte oferente / mandante
Pendiente decisión legal y tributaria: LUXTMENT SpA u otra sociedad titular/licenciataria. GMATIVE como holding no se representa como existente. Revisar contratos y propiedad intelectual antes de oferta externa.
