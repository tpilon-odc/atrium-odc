# CGP PLATFORM — Spécifications Techniques Complètes

> Document de référence pour le développement avec Claude Code
> Version 1.0 — Architecture finale

| Paramètre | Valeur |
|---|---|
| Stack principale | Next.js · Node.js · Supabase · Postgres |
| Infra | Self-hosted — Docker Compose local · Coolify prod |
| Base de données | PostgreSQL avec Row-Level Security (RLS) |
| Stockage fichiers | MinIO (compatible S3) |
| Cache | Redis |
| Emails | Resend (prod) · Mailpit (local) |
| Jobs planifiés | Trigger.dev self-hosted |
| Backoffice SaaS | Odoo Community (séparé de la plateforme) |
| Cible | 2000 cabinets CGP |

---

## 1. Contexte et objectifs

### 1.1 Description du produit

CGP Platform est un SaaS multi-tenant destiné aux cabinets de gestion de patrimoine (CGP). La plateforme couvre la gestion de la conformité réglementaire, la base communautaire de fournisseurs/produits/outils, le CRM, la GED, les formations et le partage de données entre acteurs.

### 1.2 Principes architecturaux fondamentaux

> ⚠️ Ces principes doivent guider chaque décision de développement. Ne jamais les contourner.

- **Multi-tenancy par RLS Postgres** — chaque cabinet ne voit que ses propres données. Le RLS est la dernière ligne de défense, même si l'API a un bug.
- **Un seul schéma Postgres** — pas de base par cabinet, pas de synchro inter-services. Tout est dans le même Postgres avec `cabinet_id` sur chaque table concernée.
- **Séparation communautaire / privé** — les données communautaires (fournisseurs, produits, outils, formations) sont visibles par tous les cabinets. Les données privées (notes, ratings, infos perso) sont isolées par RLS.
- **Maintenabilité avant tout** — stack standard, pas de framework propriétaire, documentation abondante. Éviter les abstractions inutiles.
- **Self-hosted de bout en bout** — même stack local et prod via Docker Compose. Pas de dépendance à des services cloud tiers sauf Resend pour les emails.

### 1.3 Ce que la plateforme N'est PAS

- **Pas un module Odoo** — Odoo Community est utilisé uniquement comme backoffice de facturation SaaS pour l'opérateur de la plateforme, pas comme moteur applicatif.
- **Pas un système de validation manuelle** — la conformité est une saisie guidée en autonomie par les cabinets, sans intervention de l'admin.
- **Pas un outil de formation en ligne** — le module formations est un référencement de formations suivies, pas une plateforme e-learning.

---

## 2. Stack technique

### 2.1 Environnement de développement local

Lancer l'environnement complet avec une seule commande :

```bash
docker-compose up
```

| Service | Image | Port | Rôle |
|---|---|---|---|
| Supabase | supabase/supabase | 54321 | Postgres + Auth + Storage + API |
| Redis | redis:alpine | 6379 | Cache · Sessions · Rate limiting |
| MinIO | minio/minio | 9000 / 9001 | Stockage S3 compatible (GED) |
| Mailpit | axllent/mailpit | 8025 / 1025 | SMTP local · UI web emails |
| Trigger.dev | trigger.dev runner | 3040 | Jobs planifiés locaux |

Next.js (port 3000) et l'API Node.js (port 3001) tournent directement sur la machine hôte via `npm run dev`.

### 2.2 Frontend — Next.js

- Framework : Next.js 14+ avec App Router
- Langage : TypeScript strict
- Style : Tailwind CSS + shadcn/ui + Radix UI
- State management : Zustand pour le state global, TanStack Query pour le cache serveur
- Formulaires : React Hook Form + Zod pour la validation
- i18n : next-intl (français par défaut)

### 2.3 Backend — API Node.js

- Framework : Fastify (performances supérieures à Express, validation native)
- Langage : TypeScript strict
- ORM : Prisma pour les migrations et le type-safety, requêtes SQL brutes pour les cas complexes
- Validation : Zod sur tous les endpoints
- Auth : JWT via Supabase Auth — le token est vérifié à chaque requête
- Jobs : Trigger.dev pour les crons (notifications d'expiration conformité)

### 2.4 Base de données — PostgreSQL via Supabase

- Version : PostgreSQL 15+
- RLS activé sur toutes les tables avec `cabinet_id`
- Migrations gérées via Prisma migrate
- Triggers pour : calcul `avg_public_rating`, `updated_at` automatique
- Index sur : `cabinet_id` (toutes tables), `expires_at` (conformité), `created_at` (tri)

### 2.5 Infrastructure de production

| Composant | Technologie | Notes |
|---|---|---|
| Serveur | VPS Hetzner CX31 EU | 4 vCPU · 8GB RAM · ~15€/mois |
| Orchestration | Coolify (self-hosted) | UI deploy · SSL auto · backups |
| Reverse proxy | Traefik (via Coolify) | SSL Let's Encrypt auto |
| CI/CD | GitHub Actions | Tests → build → deploy via Coolify |
| Monitoring | Sentry | Erreurs front + back |
| Emails prod | Resend | Transactionnel · notifs conformité |

---

## 3. Schéma de base de données

> ⚠️ RÈGLE ABSOLUE : Toutes les tables contenant des données cabinet doivent avoir une colonne `cabinet_id uuid NOT NULL` avec une politique RLS activée. Sans RLS, un bug API peut exposer les données d'un cabinet à un autre.

### 3.1 Auth & Cabinets

#### users

| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | Géré par Supabase Auth |
| email | text UNIQUE | |
| global_role | enum | `cabinet_user` · `platform_admin` · `regulator` · `chamber` |
| created_at | timestamptz | Default now() |
| last_login | timestamptz | |
| is_active | boolean | Default true |

#### cabinets

| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | Default gen_random_uuid() |
| name | text NOT NULL | |
| siret | text | |
| orias_number | text | Numéro ORIAS obligatoire CGP |
| subscription_status | enum | `active` · `trial` · `suspended` · `cancelled` |
| settings | jsonb | Paramètres cabinet (préférences UI, timezone...) |
| created_at | timestamptz | Default now() |

#### cabinet_members

| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cabinet_id | uuid FK → cabinets | RLS sur cette colonne |
| user_id | uuid FK → users | |
| role | enum | `owner` · `admin` · `member` |
| can_manage_suppliers | boolean | Ignoré si role = owner ou admin |
| can_manage_products | boolean | Ignoré si role = owner ou admin |
| can_manage_contacts | boolean | Ignoré si role = owner ou admin |

### 3.2 Conformité

> Les tables `compliance_phases` et `compliance_items` sont gérées uniquement par le `platform_admin`. Les cabinets ne peuvent pas les modifier.

#### compliance_phases

| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| label | text NOT NULL | Ex: "Identification du cabinet" |
| description | text | |
| order | int NOT NULL | Ordre d'affichage — non bloquant |
| is_active | boolean | Default true |
| created_at | timestamptz | |

#### compliance_items

| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| phase_id | uuid FK → compliance_phases | |
| label | text NOT NULL | Ex: "Kbis de moins de 3 mois" |
| type | enum | `doc` · `text` · `radio` · `checkbox` |
| config | jsonb NOT NULL | Voir structure ci-dessous |
| is_required | boolean | Default true |
| validity_months | int | NULL = pas d'expiration. Ex: 12 pour 1 an |
| alert_before_days | int[] | Ex: `{30,7}` → alertes 30j et 7j avant expiration |
| due_days_after_signup | int | Délai en jours depuis création cabinet |
| order | int NOT NULL | |

Structure du champ `config` jsonb selon le type :

```json
doc      → { "formats": ["pdf","jpg","png"], "max_mb": 10 }
text     → { "placeholder": "Décrivez...", "max_length": 500 }
radio    → { "options": ["Option A", "Option B", "Option C"] }
checkbox → { "options": ["Option A", "Option B", "Option C"] }
```

#### compliance_conditions

| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| item_id | uuid FK → compliance_items | L'item conditionné (affiché si condition OK) |
| depends_on_item_id | uuid FK → compliance_items | L'item dont la réponse est évaluée |
| operator | enum | `eq` · `not_eq` · `in` · `not_in` |
| expected_value | text | Valeur attendue pour que la condition soit vraie |

#### cabinet_compliance_answers

| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cabinet_id | uuid FK → cabinets | ← RLS |
| item_id | uuid FK → compliance_items | |
| answered_by | uuid FK → users | |
| value | jsonb NOT NULL | Voir structure ci-dessous |
| status | enum | `draft` · `submitted` |
| submitted_at | timestamptz | |
| expires_at | timestamptz | Calculé : submitted_at + validity_months. NULL si pas d'expiration |
| updated_at | timestamptz | Auto-mis à jour par trigger |

Structure du champ `value` jsonb selon le type de l'item :

```json
doc      → { "document_id": "uuid" }
text     → { "text": "Réponse libre du cabinet" }
radio    → { "selected": ["Option A"] }
checkbox → { "selected": ["Option A", "Option C"] }
```

Calcul du statut d'un item **(côté application, non stocké)** :

```
not_started   → aucune réponse en base
submitted     → réponse avec status=submitted ET (expires_at IS NULL OR expires_at > now())
expiring_soon → expires_at BETWEEN now() AND now() + INTERVAL '30 days'
expired       → expires_at < now() → compte comme not_started dans la progression
```

#### compliance_notifications

| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cabinet_id | uuid FK | ← RLS |
| answer_id | uuid FK → cabinet_compliance_answers | |
| days_before | int | Palier qui a déclenché l'alerte (ex: 30 ou 7) |
| channel | enum | `email` · `in_app` |
| sent_at | timestamptz | Évite les doublons si le job tourne deux fois |

### 3.3 Base communautaire — Pattern × 3

> Fournisseurs, Produits et Outils suivent exactement le même pattern : une table principale communautaire, une table d'historique des éditions, une table de notes publiques, une table de données privées par cabinet (RLS).

#### suppliers (même structure pour products et tools)

| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| description | text | |
| category | text | Catégorie libre ou enum selon le module |
| website / url | text | URL de contact (tools) ou site web (suppliers) |
| email / phone | text | Fournisseurs uniquement |
| created_by | uuid FK → users | Créateur — visible tous mais éditable par tous |
| avg_public_rating | float | Calculé par trigger à chaque nouvelle note publique |
| is_verified | boolean | Platform_admin peut marquer une fiche vérifiée |
| created_at | timestamptz | |

#### supplier_edits (et product_edits, tool_edits)

| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| supplier_id | uuid FK → suppliers | |
| edited_by | uuid FK → users | |
| cabinet_id | uuid FK → cabinets | |
| diff | jsonb NOT NULL | Format: `{"field": ["valeur_avant", "valeur_après"]}` |
| edited_at | timestamptz | Default now() |

#### cabinet_suppliers (et cabinet_products, cabinet_tools)

| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cabinet_id | uuid FK | ← RLS — isolation par cabinet |
| supplier_id | uuid FK → suppliers | |
| is_active | boolean | true = "je travaille avec ce fournisseur" |
| private_rating | int (1-5) | Note privée — non visible des autres cabinets |
| private_note | text | Note interne privée |
| internal_tags | text[] | Tags internes du cabinet |
| custom_fields | jsonb | Champs libres : num_contrat, interlocuteur... |

> `cabinet_products` a en plus : `is_commercialized` (bool) et `supplier_id` FK pour indiquer via quel fournisseur le produit est commercialisé. `product_suppliers` est une table pivot produit ↔ fournisseur.

### 3.4 CRM

#### contacts

| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cabinet_id | uuid FK | ← RLS |
| first_name | text | |
| last_name | text NOT NULL | |
| email | text | |
| phone | text | |
| type | enum | `prospect` · `client` · `ancien_client` |
| metadata | jsonb | Champs additionnels libres |
| created_at | timestamptz | |

#### interactions

| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| contact_id | uuid FK → contacts | |
| user_id | uuid FK → users | Qui a réalisé l'interaction |
| type | enum | `email` · `appel` · `rdv` · `note` |
| note | text | |
| occurred_at | timestamptz | |

### 3.5 GED (Gestion Électronique de Documents)

#### cabinet_storage_config

| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cabinet_id | uuid FK | ← RLS · 1 cabinet = N configs possibles |
| provider | enum | `aws` · `gdrive` · `sharepoint` · `other` |
| label | text | Ex: "Notre SharePoint RH" |
| base_url | text NOT NULL | URL de base du stockage externe |
| created_at | timestamptz | |

#### documents

| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cabinet_id | uuid FK | ← RLS |
| uploaded_by | uuid FK → users | |
| name | text NOT NULL | |
| description | text | |
| storage_mode | enum | `hosted` · `external` |
| storage_path | text | Clé MinIO/S3 si storage_mode = hosted |
| external_config_id | uuid FK → cabinet_storage_config | Si storage_mode = external |
| external_path | text | Chemin relatif. URL = base_url + external_path |
| mime_type | text | |
| size_bytes | bigint | |
| created_at | timestamptz | |

#### document_links

| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| document_id | uuid FK → documents | |
| entity_type | enum | `cabinet` · `contact` · `product` · `supplier` · `compliance_answer` |
| entity_id | uuid | ID de l'entité rattachée |
| label | text | Ex: "Kbis", "Contrat signé" |

### 3.6 Formations

#### training_catalog (communautaire)

| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| organizer | text | Organisme de formation |
| category | text | |
| default_hours | float | Durée typique en heures |
| created_by | uuid FK → users | |
| is_verified | boolean | Platform_admin peut vérifier |

#### collaborator_trainings

| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cabinet_id | uuid FK | ← RLS |
| user_id | uuid FK → users | Le collaborateur formé |
| training_id | uuid FK → training_catalog | |
| training_date | date NOT NULL | |
| hours_completed | float | Peut différer de default_hours |
| certificate_document_id | uuid FK → documents | PDF attestation dans la GED |
| notes | text | |
| created_at | timestamptz | |

### 3.7 Partage inter-utilisateurs

#### shares

| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cabinet_id | uuid FK | Cabinet qui partage |
| granted_by | uuid FK → users | Membre du cabinet qui accorde le partage |
| granted_to | uuid FK → users | Destinataire (regulator · chamber · admin...) |
| entity_type | enum | `contact` · `document` · `collaborator_training` · `cabinet_compliance` · `cabinet` |
| entity_id | uuid | NULL si entity_type = cabinet (partage global) |
| is_active | boolean | Default true · révocable à tout moment |
| created_at | timestamptz | |
| revoked_at | timestamptz | Historique conservé même après révocation |

---

## 4. Sécurité et Row-Level Security

### 4.1 Politique RLS standard

Appliquer ce template sur toutes les tables avec `cabinet_id` :

```sql
-- Activer RLS
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;

-- Lecture : un cabinet ne voit que ses données
CREATE POLICY "{table}_select" ON {table}
  FOR SELECT USING (cabinet_id = auth.uid()::uuid);

-- Écriture : idem
CREATE POLICY "{table}_insert" ON {table}
  FOR INSERT WITH CHECK (cabinet_id = auth.uid()::uuid);

-- Platform admin bypass (rôle Postgres dédié)
CREATE POLICY "{table}_admin" ON {table}
  USING (auth.jwt() ->> 'global_role' = 'platform_admin');
```

### 4.2 Tables communautaires (sans RLS sur lecture)

Les tables `suppliers`, `products`, `tools`, `training_catalog`, `compliance_phases`, `compliance_items` sont lisibles par tous les utilisateurs authentifiés. Seule l'écriture est contrôlée.

```sql
-- Lecture ouverte à tous les authentifiés
CREATE POLICY "suppliers_select" ON suppliers
  FOR SELECT USING (auth.role() = 'authenticated');
```

### 4.3 Tables de données privées

`cabinet_suppliers`, `cabinet_products`, `cabinet_tools` ont un RLS strict : un cabinet ne voit jamais les données privées d'un autre cabinet même si la fiche communautaire est partagée.

### 4.4 Système de partage et RLS

Quand un utilisateur a `global_role = regulator` ou `chamber`, il accède aux données via la table `shares`. L'API vérifie l'existence d'un share actif avant de retourner les données. Le RLS seul ne suffit pas ici — la vérification est applicative.

---

## 5. Modules fonctionnels

### 5.1 Onboarding cabinet

- L'utilisateur crée un compte via Supabase Auth
- Il crée son cabinet (nom, SIRET, ORIAS)
- Il devient automatiquement `owner` du cabinet (entrée dans `cabinet_members`)
- Il peut inviter des collaborateurs par email — invitation Supabase Auth
- L'admin du cabinet définit les permissions des membres (`can_manage_*`)
- Déclencheur Odoo → webhook → activation cabinet : quand Odoo confirme la souscription, un webhook `POST /api/cabinets/activate` est appelé avec le `cabinet_id`. L'API met à jour `subscription_status = 'active'`.

### 5.2 Conformité — règles métier

- Les phases sont ordonnées (champ `order`) mais **non bloquantes** — un cabinet peut remplir dans n'importe quel ordre
- La progression d'une phase = `items complétés / items required * 100`
- Un item est complété si : `status = submitted` ET (`expires_at IS NULL` OR `expires_at > now()`)
- Un item expiré repasse en `not_started` dans le calcul de progression
- Le job Trigger.dev tourne chaque nuit à 6h UTC et envoie les notifications pour les items dont `expires_at = now() + N jours` correspond à un palier dans `alert_before_days`
- La table `compliance_notifications` évite les doublons : avant d'envoyer, vérifier qu'il n'existe pas déjà une notification avec le même `answer_id + days_before` dans les dernières 24h

### 5.3 Base communautaire — règles métier

- **Création** : tout cabinet authentifié peut créer un fournisseur / produit / outil / formation. Visible immédiatement.
- **Édition** : tout cabinet peut modifier une fiche communautaire. Chaque modification crée une ligne dans `{entity}_edits` avec le diff avant/après.
- **Rating public** : 1 note par cabinet par entité (UNIQUE constraint sur `supplier_id + cabinet_id`). La moyenne `avg_public_rating` est recalculée par trigger Postgres à chaque insert/update/delete sur `{entity}_public_ratings`.
- **Données privées** : `cabinet_suppliers` / `cabinet_products` / `cabinet_tools` sont isolées par RLS. Un cabinet ne voit jamais les données privées des autres.

### 5.4 GED — règles métier

- Un document uploadé en mode `hosted` est stocké dans MinIO sous la clé : `cabinets/{cabinet_id}/{uuid}/{filename}`
- Un document en mode `external` stocke uniquement l'URL reconstituée = `base_url + external_path`
- Un document peut être rattaché à plusieurs entités via `document_links`
- Quand un item de conformité de type `doc` est soumis, la `value` jsonb contient le `document_id` — le document est dans la GED ET lié à la conformité, pas dupliqué

---

## 6. Structure du projet

### 6.1 Monorepo

```
cgp-platform/
├── apps/
│   ├── web/              # Next.js frontend
│   └── api/              # Fastify API Node.js
├── packages/
│   ├── db/               # Schéma Prisma + migrations
│   ├── types/            # Types TypeScript partagés
│   └── utils/            # Fonctions utilitaires partagées
├── infra/
│   ├── docker-compose.yml
│   └── coolify/          # Config prod
├── SPECS.md              # Ce fichier
└── .github/workflows/    # CI/CD
```

### 6.2 Structure API (apps/api)

```
src/
├── routes/
│   ├── auth/
│   ├── cabinets/
│   ├── compliance/
│   ├── suppliers/
│   ├── products/
│   ├── tools/
│   ├── contacts/
│   ├── documents/
│   ├── trainings/
│   └── shares/
├── middleware/
│   ├── auth.ts           # Vérification JWT Supabase
│   └── cabinet.ts        # Injection cabinet_id dans request
├── jobs/                 # Trigger.dev jobs
│   └── compliance-notifications.ts
└── lib/
    ├── supabase.ts
    ├── minio.ts
    └── resend.ts
```

### 6.3 Structure Frontend (apps/web)

```
src/
├── app/                  # App Router Next.js
│   ├── (auth)/           # Pages login/signup
│   ├── (dashboard)/      # Pages authentifiées
│   │   ├── conformite/
│   │   ├── fournisseurs/
│   │   ├── produits/
│   │   ├── outils/
│   │   ├── crm/
│   │   ├── documents/
│   │   ├── formations/
│   │   └── parametres/
│   └── (admin)/          # Pages platform_admin uniquement
├── components/
│   ├── ui/               # shadcn/ui components
│   └── [module]/         # Composants métier par module
├── hooks/                # Custom hooks
├── stores/               # Zustand stores
└── lib/
    ├── api.ts            # Client API
    └── supabase.ts       # Client Supabase
```

---

## 7. Conventions de code

### 7.1 TypeScript

- `strict: true` dans tsconfig — pas de `any` implicite
- Tous les types de la DB sont générés depuis le schéma Prisma
- Zod schemas pour toute validation entrante (API et formulaires)
- Pas d'assertions de type (`as Type`) sauf cas exceptionnel documenté

### 7.2 API

- Chaque route vérifie le JWT avant tout traitement
- Le `cabinet_id` est toujours extrait du JWT, **jamais** du body ou des params
- Les réponses suivent le format : `{ data: T }` ou `{ error: string, code: string }`
- Pagination via cursor (not offset) pour les listes potentiellement longues
- Tous les endpoints sont préfixés `/api/v1/`

### 7.3 Base de données

- Toujours utiliser des transactions pour les opérations multi-tables
- Les triggers Postgres sont préférés aux calculs applicatifs pour `avg_public_rating` et `updated_at`
- Jamais de DELETE physique sur les données cabinet — soft delete avec `deleted_at`
- Les migrations sont irréversibles par défaut — bien réfléchir avant chaque `ALTER TABLE`

### 7.4 Nommage

| Élément | Convention | Exemple |
|---|---|---|
| Tables DB | snake_case pluriel | `cabinet_members` |
| Colonnes DB | snake_case | `created_at`, `cabinet_id` |
| Types TS | PascalCase | `CabinetMember` |
| Composants React | PascalCase | `FournisseurCard` |
| Hooks | camelCase avec use | `useFournisseurDetail` |
| Endpoints API | kebab-case | `/api/v1/cabinet-members` |
| Variables env | SCREAMING_SNAKE | `SUPABASE_URL` |

---

## 8. Variables d'environnement

### 8.1 API (.env)

```env
# Supabase
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Base de données directe (Prisma)
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Redis
REDIS_URL=redis://localhost:6379

# MinIO / S3
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=cgp-documents

# Email
RESEND_API_KEY=...          # Prod uniquement
SMTP_HOST=localhost          # Mailpit local
SMTP_PORT=1025

# Trigger.dev
TRIGGER_API_KEY=...
TRIGGER_API_URL=http://localhost:3040

# App
PORT=3001
NODE_ENV=development
JWT_SECRET=...
```

### 8.2 Frontend (.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 9. Ordre de développement recommandé

> Suivre cet ordre permet d'avoir une base fonctionnelle rapidement et de valider les choix architecturaux avant de construire les modules métier.

| Étape | Module | Contenu |
|---|---|---|
| 1 | Infra locale | docker-compose.yml avec Supabase · Redis · MinIO · Mailpit |
| 2 | Schéma DB | Toutes les migrations Prisma · RLS policies · triggers avg_rating |
| 3 | Auth | Signup · Login · JWT middleware · global_role |
| 4 | Cabinets | CRUD cabinet · Invitation membres · Permissions |
| 5 | Conformité | Admin : CRUD phases/items · Cabinet : réponses · Progression |
| 6 | Fournisseurs | CRUD communautaire · Édits tracés · Données privées cabinet |
| 7 | Produits | Même pattern que fournisseurs + table pivot product_suppliers |
| 8 | Outils | Même pattern que fournisseurs (sans produits rattachés) |
| 9 | CRM | Contacts · Interactions · Pipeline basique |
| 10 | GED | Upload MinIO · Stockage externe · document_links |
| 11 | Formations | Catalogue communautaire · Suivi collaborateurs |
| 12 | Partage | Table shares · Accès regulators/chambers |
| 13 | Notifications | Job Trigger.dev · Emails expiration conformité |
| 14 | Webhook Odoo | Endpoint activation cabinet · subscription_status |
| 15 | Export | Endpoints CSV par module · API publique documentée |

---

## 10. Points d'attention critiques

### 🔴 Sécurité — Ne jamais faire

- Accepter un `cabinet_id` depuis le body ou les query params — toujours l'extraire du JWT
- Faire une requête DB sans RLS actif sur les tables cabinet
- Exposer la `SUPABASE_SERVICE_ROLE_KEY` côté frontend
- Stocker des fichiers sans valider le `mime_type` et la taille côté serveur

### 🟢 Performance — Bonnes pratiques

- Index obligatoires : `cabinet_id` sur toutes les tables, `expires_at` sur `cabinet_compliance_answers`, `created_at` sur toutes les tables pour le tri
- `avg_public_rating` : calculé par trigger Postgres, jamais en temps réel à la requête
- La progression de conformité est calculée à la requête — mettre en cache Redis 5 minutes si nécessaire
- Pagination cursor pour les listes fournisseurs / contacts (potentiellement milliers de lignes)

### 🔵 Contexte métier CGP

- IAS = Intermédiaire en Assurance · CIF = Conseiller en Investissements Financiers — deux statuts réglementaires distincts
- ORIAS = registre officiel des intermédiaires financiers — le numéro ORIAS est obligatoire pour exercer
- L'évaluation annuelle des fournisseurs (`score_global` sur 5) vient du POC Lovable existant — conserver cette logique
- 14h de formation par an est une obligation réglementaire courante en CGP — le module formations doit permettre ce suivi

---

*FIN DU DOCUMENT — CGP Platform Spécifications v1.0*
