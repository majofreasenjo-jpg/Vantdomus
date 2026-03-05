# VantDomus (mínimo) — Core + Panel (ZIP)

## Levantar servicios
```bash
cd vantdomus_core
docker compose up --build
```

## Inicializar DB (una vez)
```bash
docker ps
export DB_CONTAINER=vantdomus_core-db-1
docker exec -i $DB_CONTAINER psql -U postgres -d vantdomus < sql/000_init.sql
```

## Flujo rápido
1) POST /auth/register
2) POST /auth/login => JWT
3) POST /households => household_id
4) POST /persons => person_id
5) POST /health/adherence/set (plan)
6) POST /health/checkin (taken/missed) => alerta si 2 missed seguidos

## Panel
```bash
cd ../vantdomus_panel
npm i
cp .env.example .env.local
# pega el TOKEN y el HOUSEHOLD_ID
npm run dev
```
