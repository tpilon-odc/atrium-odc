# CGP Platform — Spécifications Core
> Stack · Architecture · Auth · Cabinets · Conventions
> Version 1.2

## Stack technique

| Élément | Technologie |
|---|---|
| Frontend | Next.js 14+ App Router · TypeScript strict · Tailwind + shadcn/ui |
| Backend | Fastify · TypeScript strict · Prisma · Zod |
| Base de données | PostgreSQL 15+ via Supabase · RLS obligatoire |
| Auth | Supabase Auth · JWT vérifié à chaque requête |
| Cache | Redis |
| Storage | MinIO (compatible S3) |
| Jobs | Trigger.dev self-hosted |
| Emails | Resend (prod) · Mailpit (local) |
| Calendrier | @fullcalendar/react v6 (MIT) |
| Infra local | docker-compose up (Supabase :54321 · Redis :6379 · MinIO :9000 · Mailpit :8025 · Trigger.dev :3040) |
| Infra prod | VPS Hetzner CX31 · Coolify · Traefik · GitHub Actions |

---

## Principes absolus — ne jamais violer

1. `cabinet_id` toujours extrait du JWT — jamais du body ou des params
2. RLS activé sur TOUTES les tables avec `cabinet_id`
3. Jamais de DELETE physique sur données cabinet — soft delete avec `deleted_at`
4. TypeScript strict — pas de `any`
5. Zod sur tous les endpoints et formulaires
6. Transactions pour toutes les opérations multi-tables

---

## RLS — template standard

```sql
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "{table}_select" ON {table}
  FOR SELECT USING (cabinet_id = auth.uid()::uuid);

CREATE POLICY "{table}_insert" ON {table}
  FOR INSERT WITH CHECK (cabinet_id = auth.uid()::uuid);

CREATE POLICY "{table}_admin" ON {table}
  USING (auth.jwt() ->> 'global_role' = 'platform_admin');
```

Tables communautaires (suppliers, products, tools, training_catalog, compliance_phases, compliance_items) :
```sql
CREATE POLICY "suppliers_select" ON suppliers
  FOR SELECT USING (auth.role() = 'authenticated');
```

---

## Schéma DB — Auth & Cabinets

### users
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | Supabase Auth |
| email | text UNIQUE | |
| global_role | enum | `cabinet_user` · `platform_admin` · `regulator` · `chamber` |
| gdpr_anonymized_at | timestamptz | Date anonymisation RGPD |
| created_at | timestamptz | |
| last_login | timestamptz | |
| is_active | boolean | Default true |

### cabinets
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| siret | text | |
| orias_number | text | Obligatoire CGP |
| subscription_status | enum | `active` · `trial` · `suspended` · `cancelled` |
| settings | jsonb | |
| ics_token | uuid UNIQUE | Flux ICS public |
| deletion_requested_at | timestamptz | RGPD |
| deletion_scheduled_at | timestamptz | RGPD |
| created_at | timestamptz | |

### cabinet_members
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cabinet_id | uuid FK | ← RLS |
| user_id | uuid FK | |
| role | enum | `owner` · `admin` · `member` |
| can_manage_suppliers | boolean | |
| can_manage_products | boolean | |
| can_manage_contacts | boolean | |

### consent_records
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| version | text | Ex: "CGU-v1.2" |
| accepted_at | timestamptz | |
| ip_address | text | |
| user_agent | text | |

---

## Structure du projet

```
cgp-platform/
├── apps/
│   ├── web/              # Next.js
│   └── api/              # Fastify
├── packages/
│   ├── db/               # Prisma + migrations
│   ├── types/            # Types partagés
│   └── utils/
├── infra/
│   └── docker-compose.yml
└── SPECS_*.md            # Specs par module
```

### Structure API
```
src/
├── routes/           # auth/ cabinets/ compliance/ suppliers/
│                     # products/ tools/ contacts/ documents/
│                     # trainings/ events/ notifications/
│                     # shares/ clusters/ gdpr/
├── middleware/
│   ├── auth.ts       # JWT Supabase
│   └── cabinet.ts    # Injection cabinet_id
├── jobs/             # Trigger.dev
└── lib/              # supabase · minio · resend · calendar
```

### Structure Frontend
```
src/app/
├── (auth)/           # login · signup · consent
├── (dashboard)/      # conformite · fournisseurs · produits
│                     # outils · crm · agenda · documents
│                     # formations · notifications · clusters
│                     # parametres
├── (admin)/          # conformite · clusters · rgpd
└── (public)/         # legal/privacy · legal/terms
```

---

## Conventions de code

### Nommage
| Élément | Convention | Exemple |
|---|---|---|
| Tables DB | snake_case pluriel | `cabinet_members` |
| Colonnes DB | snake_case | `created_at` |
| Types TS | PascalCase | `CabinetMember` |
| Composants React | PascalCase | `FournisseurCard` |
| Hooks | camelCase + use | `useFournisseurDetail` |
| Endpoints | kebab-case | `/api/v1/cabinet-members` |
| Env vars | SCREAMING_SNAKE | `SUPABASE_URL` |

### Réponses API
```typescript
{ data: T }           // succès
{ error: string, code: string }  // erreur
```
Pagination : cursor (jamais offset)
Préfixe : `/api/v1/`

---

## Variables d'environnement

```env
# Supabase
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Services
REDIS_URL=redis://localhost:6379
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=cgp-documents

# Email
RESEND_API_KEY=...
SMTP_HOST=localhost
SMTP_PORT=1025

# Jobs
TRIGGER_API_KEY=...
TRIGGER_API_URL=http://localhost:3040

# App
PORT=3001
NODE_ENV=development
JWT_SECRET=...
CGU_VERSION=1.0
PRIVACY_VERSION=1.0
GDPR_ADMIN_EMAIL=...
SYSTEM_USER_ID=...

# Frontend
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Contexte métier CGP
- IAS = Intermédiaire en Assurance · CIF = Conseiller en Investissements Financiers
- ORIAS = registre officiel des intermédiaires financiers
- 14h de formation/an = obligation réglementaire CGP
- score_global fournisseurs sur 5 = logique du POC Lovable — à conserver
- Non-conformité = risque de sanctions AMF/ACPR

---

*SPECS_CORE v1.2 — à utiliser pour : infra, auth, cabinets, conventions*
