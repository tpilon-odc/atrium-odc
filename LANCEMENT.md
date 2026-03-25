# CGP Platform — Guide de lancement local

## Ordre de démarrage

### 1. Infrastructure Docker — Redis + MinIO + Mailpit
```bash
npm run infra:up
```

### 2. Supabase — PostgreSQL + Auth
```bash
supabase start
```
> Affiche les clés `anon` et `service_role` — vérifier qu'elles correspondent aux `.env`

### 3. API — terminal dédié
```bash
npm run dev:api
```
> Tourne sur `http://localhost:3001`

### 4. Frontend — terminal dédié
```bash
npm run dev:web
```
> Tourne sur `http://localhost:3000`

---

## Interfaces disponibles

| Service        | URL                            | Identifiants              |
|----------------|--------------------------------|---------------------------|
| App web        | http://localhost:3000          | —                         |
| Swagger API    | http://localhost:3001/documentation | —                    |
| Supabase Studio| http://localhost:54323         | —                         |
| MinIO Console  | http://localhost:9001          | `minioadmin` / `minioadmin` |
| Mailpit (emails)| http://localhost:8025         | —                         |

---

## Arrêt propre

```bash
npm run infra:down   # Docker
supabase stop        # Supabase
# Ctrl+C sur les terminaux API et Web
```

---

## Fichiers .env à vérifier

### `apps/api/.env`
```
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
DIRECT_URL=postgresql://postgres:postgres@localhost:54322/postgres
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<clé anon fournie par supabase start>
SUPABASE_SERVICE_ROLE_KEY=<clé service_role fournie par supabase start>
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=cgp-documents
SMTP_HOST=localhost
SMTP_PORT=1025
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### `apps/web/.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé anon fournie par supabase start>
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Dépannage

### Port déjà utilisé (ex: 3001)
```bash
lsof -ti :3001 | xargs kill -9
# puis relancer npm run dev:api
```

### Régénérer le client Prisma après une migration
```bash
cd packages/db
npx prisma generate
```

### Appliquer les migrations Prisma
```bash
cd packages/db
npx prisma migrate dev
```

#### Lancement des tests 
```bash
cd apps/api && npm test