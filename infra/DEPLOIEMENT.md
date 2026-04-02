# Guide de déploiement — myGaïa Platform (on-premise)

## Architecture

```
VPS
├── /opt/supabase/        ← Supabase officiel (Postgres, Auth, Storage, Studio)
│   └── docker-compose.yml
└── /opt/mygaia/          ← Ce repo
    ├── apps/web/         ← Next.js 14
    ├── apps/api/         ← Fastify
    └── infra/
        ├── docker-compose.prod.yml   ← web, api, nginx, redis, minio, mailpit
        ├── nginx/nginx.conf
        └── .env.prod
```

Les deux stacks communiquent via un réseau Docker partagé (`supabase_network`).

---

## Prérequis

- Ubuntu 22.04 LTS (ou Debian 12)
- 4 Go RAM minimum (8 Go recommandé)
- 40 Go disque minimum
- Un nom de domaine pointant sur le serveur (ou une IP fixe)

---

## Étape 1 — Installer Docker

```bash
apt update && apt install -y curl git
curl -fsSL https://get.docker.com | sh
# Vérifier
docker --version
docker compose version
```

---

## Étape 2 — Installer Supabase self-hosted

```bash
mkdir -p /opt/supabase && cd /opt/supabase

# Télécharger le docker-compose et l'env officiel
curl -L https://raw.githubusercontent.com/supabase/supabase/master/docker/docker-compose.yml -o docker-compose.yml
curl -L https://raw.githubusercontent.com/supabase/supabase/master/docker/.env.example -o .env

# Ouvrir .env et remplir les valeurs obligatoires (voir section ci-dessous)
nano .env
```

### Variables Supabase à remplir dans `/opt/supabase/.env`

Générer les secrets :
```bash
# JWT_SECRET (min 32 chars)
openssl rand -base64 32

# ANON_KEY et SERVICE_ROLE_KEY : générer sur https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys
# Ou avec la commande :
node -e "
const jwt = require('jsonwebtoken');
const secret = 'VOTRE_JWT_SECRET_ICI';
console.log('ANON_KEY:', jwt.sign({ role: 'anon' }, secret, { expiresIn: '10y' }));
console.log('SERVICE_ROLE_KEY:', jwt.sign({ role: 'service_role' }, secret, { expiresIn: '10y' }));
"
```

Valeurs à modifier dans `.env` :
```env
POSTGRES_PASSWORD=mot-de-passe-fort
JWT_SECRET=votre-secret-min-32-chars
ANON_KEY=jwt-anon-généré
SERVICE_ROLE_KEY=jwt-service-role-généré
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=mot-de-passe-dashboard
SITE_URL=https://app.mygaia.fr
API_EXTERNAL_URL=https://supabase.mygaia.fr
SUPABASE_PUBLIC_URL=https://supabase.mygaia.fr
```

### Lancer Supabase

```bash
cd /opt/supabase
docker compose up -d

# Vérifier que tout tourne
docker compose ps
```

Supabase Studio sera accessible sur `http://localhost:3000` (en local via tunnel SSH).

---

## Étape 3 — Cloner le repo myGaïa

```bash
git clone https://github.com/tpilon-odc/atrium-odc.git /opt/mygaia
cd /opt/mygaia
```

---

## Étape 4 — Configurer les variables d'env

```bash
cp infra/.env.prod.example infra/.env.prod
nano infra/.env.prod
```

Reprendre les valeurs générées pour Supabase :
```env
SUPABASE_URL=https://supabase.mygaia.fr
SUPABASE_ANON_KEY=jwt-anon-généré      # même valeur que dans /opt/supabase/.env
SUPABASE_SERVICE_ROLE_KEY=jwt-service-role-généré
API_URL=https://api.mygaia.fr
JWT_SECRET=votre-secret-min-32-chars   # même valeur que SUPABASE_JWT_SECRET
MINIO_ACCESS_KEY=minio-admin
MINIO_SECRET_KEY=minio-mot-de-passe
```

---

## Étape 5 — Certificats SSL

### Option A — Let's Encrypt (domaine public)

```bash
apt install -y certbot
# Stopper nginx s'il tourne déjà sur le port 80
certbot certonly --standalone -d app.mygaia.fr -d api.mygaia.fr -d supabase.mygaia.fr

mkdir -p /opt/mygaia/infra/nginx/certs
cp /etc/letsencrypt/live/app.mygaia.fr/fullchain.pem /opt/mygaia/infra/nginx/certs/
cp /etc/letsencrypt/live/app.mygaia.fr/privkey.pem /opt/mygaia/infra/nginx/certs/
```

### Option B — Certificat auto-signé (test sans domaine)

```bash
mkdir -p /opt/mygaia/infra/nginx/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /opt/mygaia/infra/nginx/certs/privkey.pem \
  -out /opt/mygaia/infra/nginx/certs/fullchain.pem \
  -subj "/CN=localhost"
```

> Le navigateur affichera un avertissement SSL — normal pour un certificat auto-signé.

---

## Étape 6 — Adapter la configuration Nginx

Éditer `/opt/mygaia/infra/nginx/nginx.conf` et remplacer les `server_name` :

```bash
sed -i 's/app.mygaia.fr/VOTRE_DOMAINE_APP/g' /opt/mygaia/infra/nginx/nginx.conf
sed -i 's/api.mygaia.fr/VOTRE_DOMAINE_API/g' /opt/mygaia/infra/nginx/nginx.conf
```

---

## Étape 7 — Créer le réseau Docker partagé

```bash
# Le réseau doit exister avant de lancer notre stack
docker network create supabase_network 2>/dev/null || true

# Connecter le kong de Supabase à ce réseau
docker network connect supabase_network supabase-kong-1 2>/dev/null || true
```

> Le nom exact du container kong peut varier. Vérifier avec `docker ps | grep kong`.

---

## Étape 8 — Lancer la stack myGaïa

```bash
cd /opt/mygaia
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod up -d --build
```

Le premier `--build` peut prendre 5-10 minutes (compilation Next.js + Fastify).

---

## Étape 9 — Vérifications

```bash
# État de tous les containers
docker compose -f infra/docker-compose.prod.yml ps

# Logs en temps réel
docker compose -f infra/docker-compose.prod.yml logs -f web
docker compose -f infra/docker-compose.prod.yml logs -f api

# Test HTTP
curl -k https://app.mygaia.fr
curl -k https://api.mygaia.fr/health
```

---

## Mises à jour

```bash
cd /opt/mygaia
git pull
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod up -d --build web api
```

Seuls `web` et `api` sont rebuilds — redis/minio/nginx redémarrent sans rebuild.

---

## Backup des données

```bash
# Postgres (via Supabase)
cd /opt/supabase
docker compose exec db pg_dump -U postgres postgres > backup_$(date +%Y%m%d).sql

# MinIO (volumes Docker)
docker run --rm -v cgp-minio_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/minio_$(date +%Y%m%d).tar.gz /data
```

---

## Renouvellement SSL automatique (Let's Encrypt)

```bash
# Ajouter un cron
crontab -e
# Ajouter cette ligne :
0 3 * * * certbot renew --quiet && \
  cp /etc/letsencrypt/live/app.mygaia.fr/fullchain.pem /opt/mygaia/infra/nginx/certs/ && \
  cp /etc/letsencrypt/live/app.mygaia.fr/privkey.pem /opt/mygaia/infra/nginx/certs/ && \
  docker restart cgp-nginx
```

---

## Ports exposés sur le serveur

| Port | Service | Accès |
|------|---------|-------|
| 80 | Nginx (redirect HTTPS) | Public |
| 443 | Nginx (app + api) | Public |
| 8025 | Mailpit UI | localhost uniquement |
| 3000 | Supabase Studio | localhost uniquement (tunnel SSH) |

Accéder au Studio Supabase depuis votre machine locale :
```bash
ssh -L 3000:localhost:3000 user@votre-serveur
# Puis ouvrir http://localhost:3000
```
