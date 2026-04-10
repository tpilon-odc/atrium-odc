# Guide de déploiement — myGaïa Platform (on-premise)

## Architecture

```
VPS
├── /opt/supabase/        ← Supabase officiel (Postgres, Auth, Storage, Studio)
│   ├── docker-compose.yml
│   └── .env
└── /opt/mygaia/          ← Ce repo (git clone)
    ├── apps/web/         ← Next.js 14
    ├── apps/api/         ← Fastify
    └── infra/
        ├── docker-compose.prod.yml
        ├── nginx/nginx.conf
        ├── .env.prod.example
        └── .env.prod     ← à créer (gitignored)
```

Les deux stacks communiquent via le réseau Docker `supabase_network` (externe).
Le container `supabase-db` doit être connecté à ce réseau pour que l'API puisse faire les migrations.

---

## Étape 1 — Installer Docker

```bash
apt update && apt install -y curl git
curl -fsSL https://get.docker.com | sh
docker --version && docker compose version
```

---

## Étape 2 — Installer Supabase self-hosted

```bash
mkdir -p /opt/supabase && cd /opt/supabase

# Télécharger le compose et l'env officiel
curl -L https://raw.githubusercontent.com/supabase/supabase/master/docker/docker-compose.yml -o docker-compose.yml
curl -L https://raw.githubusercontent.com/supabase/supabase/master/docker/.env.example -o .env
```

### ⚠️ Créer les fichiers de volume AVANT docker compose up

Docker crée des **dossiers vides** si les fichiers n'existent pas au premier `up`.
Cela brise kong, le pooler et vector de façon silencieuse.

```bash
mkdir -p volumes/api volumes/db volumes/pooler volumes/logs volumes/storage volumes/functions

curl -L https://raw.githubusercontent.com/supabase/supabase/master/docker/volumes/api/kong.yml -o volumes/api/kong.yml
curl -L https://raw.githubusercontent.com/supabase/supabase/master/docker/volumes/api/kong-entrypoint.sh -o volumes/api/kong-entrypoint.sh
chmod +x volumes/api/kong-entrypoint.sh
curl -L https://raw.githubusercontent.com/supabase/supabase/master/docker/volumes/db/roles.sql -o volumes/db/roles.sql
curl -L https://raw.githubusercontent.com/supabase/supabase/master/docker/volumes/db/jwt.sql -o volumes/db/jwt.sql
curl -L https://raw.githubusercontent.com/supabase/supabase/master/docker/volumes/db/webhooks.sql -o volumes/db/webhooks.sql
curl -L https://raw.githubusercontent.com/supabase/supabase/master/docker/volumes/db/logs.sql -o volumes/db/logs.sql
curl -L https://raw.githubusercontent.com/supabase/supabase/master/docker/volumes/db/realtime.sql -o volumes/db/realtime.sql
curl -L https://raw.githubusercontent.com/supabase/supabase/master/docker/volumes/db/_supabase.sql -o volumes/db/_supabase.sql
curl -L https://raw.githubusercontent.com/supabase/supabase/master/docker/volumes/pooler/pooler.exs -o volumes/pooler/pooler.exs
curl -L https://raw.githubusercontent.com/supabase/supabase/master/docker/volumes/logs/vector.yml -o volumes/logs/vector.yml
```

### Variables à remplir dans `/opt/supabase/.env`

> **⚠️ POSTGRES_PASSWORD** : ne pas utiliser de caractères spéciaux (`+`, `=`, `/`).
> Utiliser `openssl rand -hex 32`

```bash
# Générer les secrets
openssl rand -hex 32  # → POSTGRES_PASSWORD
openssl rand -hex 32  # → JWT_SECRET
```

Pour `ANON_KEY` et `SERVICE_ROLE_KEY`, utiliser le générateur officiel :
https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys

```env
POSTGRES_PASSWORD=<hex32>
JWT_SECRET=<hex32>
ANON_KEY=<jwt-anon>
SERVICE_ROLE_KEY=<jwt-service-role>
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=<mot-de-passe>
SITE_URL=http://<IP_SERVEUR>
API_EXTERNAL_URL=http://<IP_SERVEUR>:8000
SUPABASE_PUBLIC_URL=http://<IP_SERVEUR>:8000
```

### Premier démarrage Supabase

```bash
cd /opt/supabase
docker compose up -d
```

### ⚠️ Étapes manuelles obligatoires (une seule fois)

La base `_supabase` et certains schémas ne sont pas créés automatiquement :

```bash
# 1. Créer la base analytics et les schémas
docker exec supabase-db psql -U postgres -c "CREATE DATABASE _supabase OWNER supabase_admin;"
docker exec supabase-db psql -U postgres -d _supabase -c "CREATE SCHEMA _analytics;"
docker exec supabase-db psql -U postgres -d _supabase -c "CREATE SCHEMA IF NOT EXISTS _realtime;"
docker exec supabase-db psql -U postgres -d _supabase -c "ALTER SCHEMA _realtime OWNER TO supabase_admin;"

# 2. Logflare utilise le mot de passe hardcodé 'supabase_admin' (pas POSTGRES_PASSWORD)
docker exec supabase-db psql -U postgres -c "ALTER USER supabase_admin PASSWORD 'supabase_admin';"

# 3. Corriger les fonctions auth
docker exec supabase-db psql -U postgres -c "ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;"
docker exec supabase-db psql -U postgres -c "ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin;"
docker exec supabase-db psql -U postgres -c "ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;"

# 4. Réinitialiser le mot de passe postgres pour les connexions TCP
docker exec supabase-db psql -U postgres -c "ALTER USER postgres PASSWORD '$(grep POSTGRES_PASSWORD /opt/supabase/.env | cut -d= -f2)';"

# 5. Relancer
docker compose up -d
```

Vérifier que tous les services sont healthy :
```bash
docker compose ps
```

---

## Étape 3 — Cloner le repo

```bash
git clone https://github.com/tpilon-odc/atrium-odc.git /opt/mygaia
cd /opt/mygaia
```

---

## Étape 4 — Créer le fichier `.env.prod`

```bash
cp infra/.env.prod.example infra/.env.prod
ln -s /opt/mygaia/infra/.env.prod /opt/mygaia/infra/.env
nano infra/.env.prod
```

### Toutes les variables requises

```env
# Supabase (reprendre depuis /opt/supabase/.env)
SUPABASE_URL=http://<IP_SERVEUR>:8000
SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>

# Next.js build-time (OBLIGATOIRE — inliné dans le bundle JS)
NEXT_PUBLIC_SUPABASE_URL=http://<IP_SERVEUR>:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
NEXT_PUBLIC_API_URL=http://<IP_SERVEUR>/api

# API
API_URL=http://<IP_SERVEUR>/api
JWT_SECRET=<même valeur que dans /opt/supabase/.env>
FRONTEND_URL=http://<IP_SERVEUR>

# Base de données (connexion directe Postgres, pas via pooler)
DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@supabase-db:5432/postgres
DIRECT_URL=postgresql://postgres:<POSTGRES_PASSWORD>@supabase-db:5432/postgres

# MinIO
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=<hex32>
MINIO_BUCKET=cgp-documents

# SMTP (mailpit en dev, SMTP externe en prod)
SMTP_HOST=mailpit
SMTP_PORT=1025
```

> **⚠️ `NEXT_PUBLIC_*`** : Ces variables sont inlinées dans le bundle JS au moment du `docker compose build`.
> Elles doivent être dans `.env.prod` AVANT le build. Un rebuild est nécessaire si elles changent.

---

## Étape 5 — Créer le réseau partagé et connecter supabase-db

```bash
# Créer le réseau partagé (une seule fois)
docker network create supabase_network 2>/dev/null || true

# Connecter supabase-db au réseau pour que l'API puisse faire les migrations
docker network connect supabase_network supabase-db
```

> **⚠️** Cette connexion réseau est perdue au redémarrage de supabase-db.
> Pour la rendre permanente, ajouter `supabase_network` dans le `docker-compose.yml` Supabase
> pour le service `db`.

---

## Étape 6 — Builder et lancer la stack

```bash
cd /opt/mygaia/infra
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Le premier build prend 5-15 minutes.

---

## Étape 7 — Migrations Prisma

```bash
cd /opt/mygaia/infra

# S'assurer que supabase-db est sur le réseau
docker network connect supabase_network supabase-db 2>/dev/null || true

# Lancer les migrations
docker compose -f docker-compose.prod.yml exec api \
  npx prisma migrate deploy --schema=/app/packages/db/prisma/schema.prisma
```

---

## Étape 8 — Créer le premier utilisateur admin

```bash
SERVICE_KEY=$(grep "^SERVICE_ROLE_KEY=" /opt/supabase/.env | cut -d= -f2)

curl -s -X POST http://<IP_SERVEUR>:8000/auth/v1/admin/users \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"MotDePasse1234!","email_confirm":true}'
```

---

## Étape 9 — Vérifications

```bash
# État des containers
docker compose -f docker-compose.prod.yml ps

# Test API
curl http://<IP_SERVEUR>/api/v1/health

# Test web
curl -o /dev/null -w "%{http_code}" http://<IP_SERVEUR>/

# Logs
docker logs cgp-api --tail=20
docker logs cgp-web --tail=20
```

---

## Mises à jour

```bash
cd /opt/mygaia
git pull

cd infra

# Rebuild uniquement web et api
docker compose -f docker-compose.prod.yml build web api
docker compose -f docker-compose.prod.yml up -d --force-recreate web api

# Si des migrations ont été ajoutées
docker network connect supabase_network supabase-db 2>/dev/null || true
docker compose -f docker-compose.prod.yml exec api \
  npx prisma migrate deploy --schema=/app/packages/db/prisma/schema.prisma
```

---

## Backup

```bash
# Postgres
docker exec supabase-db pg_dump -U postgres postgres > backup_$(date +%Y%m%d).sql

# MinIO
docker run --rm \
  -v infra_minio_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/minio_$(date +%Y%m%d).tar.gz /data
```

---

## Ports

| Port | Service | Notes |
|------|---------|-------|
| 80 | Nginx → web (Next.js) + /api → API | Public |
| 8000 | Kong (Supabase gateway) | Interne |
| 8025 | Mailpit UI | `127.0.0.1` uniquement |
| 9001 | MinIO console | Interne |

Accès au Studio Supabase (port 8000) depuis votre poste :
```bash
ssh -L 8000:localhost:8000 user@<IP_SERVEUR>
# Puis ouvrir http://localhost:8000
```
