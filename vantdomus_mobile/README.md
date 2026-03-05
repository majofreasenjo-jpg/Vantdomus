# VantDomus Mobile/Tablet v0.6 (Expo)

v0.6 agrega:
- Login/Register dentro de la app (sin pegar token manual)
- Selección de household
- Chat IA (si backend tiene OPENAI_API_KEY, si no fallback)
- Push: registra token Expo automáticamente (si aceptas permisos)

## Requisitos
- Node 18+
- Expo Go en teléfono/tablet
- Backend VantDomus corriendo

## Config
```bash
npm i
cp .env.example .env
```
Si pruebas desde teléfono/tablet, en `.env` usa la IP LAN del PC:
`EXPO_PUBLIC_API_BASE=http://192.168.1.10:8001`

## Ejecutar
```bash
npm start
```
