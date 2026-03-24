# CGP Platform — Spécifications Communauté
> Fournisseurs · Produits · Outils · Clusters · Formations · Partage
> Version 1.2

## Pattern communautaire × 3 (suppliers / products / tools)

Même structure pour les trois. Différences :
- `products` a en plus `is_commercialized` + `supplier_id` + table pivot `product_suppliers`
- `tools` a `url` au lieu de `email/phone`

### suppliers (même structure products / tools)
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| description | text | |
| category | text | |
| website / url | text | |
| email / phone | text | Suppliers uniquement |
| created_by | uuid FK | |
| avg_public_rating | float | Trigger Postgres |
| is_verified | boolean | platform_admin |
| created_at | timestamptz | |

### supplier_edits (product_edits / tool_edits)
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| supplier_id | uuid FK | |
| edited_by | uuid FK | |
| cabinet_id | uuid FK | |
| diff | jsonb | `{"field": ["avant", "après"]}` |
| edited_at | timestamptz | |

### cabinet_suppliers (cabinet_products / cabinet_tools)
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cabinet_id | uuid FK | ← RLS |
| supplier_id | uuid FK | |
| is_active | boolean | "je travaille avec" |
| private_rating | int (1-5) | |
| private_note | text | |
| internal_tags | text[] | |
| custom_fields | jsonb | num_contrat, interlocuteur... |

### supplier_public_ratings (product / tool)
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| supplier_id | uuid FK | |
| cabinet_id | uuid FK | |
| rating | int (1-5) | |
| comment | text | |
| created_at | timestamptz | |

> UNIQUE constraint sur `supplier_id + cabinet_id` — 1 note par cabinet.
> `avg_public_rating` recalculé par trigger Postgres.

### product_suppliers (pivot)
| Colonne | Type | Description |
|---|---|---|
| product_id | uuid FK | |
| supplier_id | uuid FK | |
| is_active | boolean | |
| conditions | jsonb | |

---

## Règles métier communauté

- Création : tout cabinet peut créer. Visible immédiatement.
- Édition : tout cabinet peut modifier → crée une ligne dans `{entity}_edits`
- Rating public : 1 note/cabinet (UNIQUE). Moyenne = trigger Postgres.
- Données privées (`cabinet_*`) : RLS strict, jamais visibles des autres.

---

## Routes API communauté

### Suppliers (même structure products / tools)
| Méthode | Endpoint | Description |
|---|---|---|
| GET | /api/v1/suppliers | Liste communautaire |
| POST | /api/v1/suppliers | Créer |
| PATCH | /api/v1/suppliers/:id | Modifier (trace diff) |
| GET | /api/v1/suppliers/:id | Détail |
| POST | /api/v1/suppliers/:id/ratings | Note publique |
| GET | /api/v1/cabinet-suppliers | Données privées cabinet |
| PATCH | /api/v1/cabinet-suppliers/:id | Modifier données privées |

---

## Formations

### training_catalog (communautaire)
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| organizer | text | |
| category | text | |
| default_hours | float | |
| created_by | uuid FK | |
| is_verified | boolean | |

### collaborator_trainings
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cabinet_id | uuid FK | ← RLS |
| user_id | uuid FK | |
| training_id | uuid FK | |
| training_date | date NOT NULL | |
| hours_completed | float | |
| certificate_document_id | uuid FK | PDF dans GED |
| notes | text | |
| created_at | timestamptz | |

> 14h/an = obligation réglementaire CGP — ce module permet le suivi.

---

## Partage inter-utilisateurs

### shares
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cabinet_id | uuid FK | Cabinet qui partage |
| granted_by | uuid FK | |
| granted_to | uuid FK | |
| entity_type | enum | `contact` · `document` · `collaborator_training` · `cabinet_compliance` · `cabinet` |
| entity_id | uuid | NULL si entity_type = cabinet |
| is_active | boolean | Default true |
| created_at | timestamptz | |
| revoked_at | timestamptz | |

> `regulator` et `chamber` accèdent aux données via `shares`. Vérification applicative côté API (RLS seul ne suffit pas).

---

## Clusters (espaces de discussion)

### clusters
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| description | text | |
| created_by | uuid FK | |
| is_public | boolean | Default true |
| is_verified | boolean | platform_admin |
| avatar_url | text | |
| created_at | timestamptz | |

### cluster_members
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cluster_id | uuid FK | |
| cabinet_id | uuid FK | Un cabinet entier rejoint |
| role | enum | `OWNER` · `ADMIN` · `MEMBER` |
| joined_at | timestamptz | |
| invited_by | uuid FK | |

> UNIQUE sur `cluster_id + cabinet_id`. Créateur = OWNER. Channel `#général` créé automatiquement.

### channels
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cluster_id | uuid FK | |
| name | text NOT NULL | |
| type | enum | `ASYNC` (forum, polling 30s) · `REALTIME` (WebSocket Supabase) |
| is_private | boolean | Default false |
| created_by | uuid FK | |
| last_message_at | timestamptz | |

### messages
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| channel_id | uuid FK | |
| author_user_id | uuid FK | |
| author_cabinet_id | uuid FK | |
| content | text | Markdown simple |
| parent_id | uuid FK | NULL = post · non-null = thread |
| deleted_at | timestamptz | Soft delete → "[Message supprimé]" |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### message_reactions
| Colonne | Type | Description |
|---|---|---|
| message_id | uuid FK | |
| user_id | uuid FK | |
| cabinet_id | uuid FK | |
| emoji | text | |

> UNIQUE sur `message_id + user_id + emoji` — toggle add/remove.

### message_reports
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| message_id | uuid FK | |
| reported_by | uuid FK | |
| reason | text | |
| status | enum | `PENDING` · `REVIEWED` · `DISMISSED` |

> RLS : lecture uniquement platform_admin.
> Pièces jointes : `document_links` avec `entity_type = 'message'`.

## Règles métier clusters

- Cluster public → visible dans l'explorateur par tous.
- Message supprimé → "[Message supprimé]" (jamais blank).
- OWNER/ADMIN peut supprimer n'importe quel message.
- Modération : signalement → tu traites dans `/admin/clusters`.

## Routes API clusters

| Méthode | Endpoint | Description |
|---|---|---|
| GET | /api/v1/clusters | Publics + du cabinet |
| POST | /api/v1/clusters | Créer |
| PATCH | /api/v1/clusters/:id | Modifier (OWNER/ADMIN) |
| POST | /api/v1/clusters/:id/join | Rejoindre |
| POST | /api/v1/clusters/:id/leave | Quitter |
| POST | /api/v1/clusters/:id/invite | Inviter cabinet |
| GET | /api/v1/clusters/:id/channels | Channels accessibles |
| POST | /api/v1/clusters/:id/channels | Créer channel |
| GET | /api/v1/channels/:id/messages | Messages (cursor) |
| POST | /api/v1/channels/:id/messages | Poster |
| PATCH | /api/v1/messages/:id | Modifier le sien |
| DELETE | /api/v1/messages/:id | Soft delete |
| POST | /api/v1/messages/:id/reactions | Toggle réaction |
| POST | /api/v1/messages/:id/report | Signaler |
| GET | /api/v1/admin/reports | Signalements (admin) |
| PATCH | /api/v1/admin/reports/:id | Traiter signalement |

## Pages frontend clusters

| Route | Description |
|---|---|
| /clusters | Layout principal (sidebar + channels + messages) |
| /clusters/explorer | Grille clusters publics |
| /admin/clusters | Modération signalements |

---

*SPECS_COMMUNITY v1.2 — à utiliser pour : fournisseurs, produits, outils, clusters, formations, partage*
