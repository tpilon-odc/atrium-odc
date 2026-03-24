# CGP Platform — Spécifications GED
> Gestion Électronique de Documents · Dossiers · Tags · Export
> Version 1.2

## Schéma DB

### cabinet_storage_config
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cabinet_id | uuid FK | ← RLS · N configs possibles |
| provider | enum | `aws` · `gdrive` · `sharepoint` · `other` |
| label | text | Ex: "Notre SharePoint RH" |
| base_url | text NOT NULL | |
| created_at | timestamptz | |

### documents
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cabinet_id | uuid FK | ← RLS |
| uploaded_by | uuid FK | |
| name | text NOT NULL | |
| description | text | |
| folder_id | uuid FK | NULL = racine |
| storage_mode | enum | `hosted` · `external` |
| storage_path | text | Clé MinIO si hosted |
| external_config_id | uuid FK | Si external |
| external_path | text | URL = base_url + external_path |
| mime_type | text | |
| size_bytes | bigint | |
| created_at | timestamptz | |

### document_links
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| document_id | uuid FK | |
| entity_type | enum | `cabinet` · `contact` · `product` · `supplier` · `compliance_answer` · `message` |
| entity_id | uuid | |
| label | text | Ex: "Kbis", "Contrat signé" |

### folders
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cabinet_id | uuid FK | ← RLS |
| name | text NOT NULL | |
| parent_id | uuid FK | NULL = racine |
| is_system | boolean | Default false — non supprimable si true |
| order | int | Default 0 |
| created_at | timestamptz | |

> Dossiers système créés à l'onboarding : Conformité / Clients / Formations / Divers (+ sous-dossiers).
> RLS exception : dossiers système lisibles par tous, non modifiables.

### tags
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cabinet_id | uuid FK | NULL = tag système (platform_admin) |
| name | text NOT NULL | |
| color | text | Hex ex: #3B82F6 |
| is_system | boolean | Default false |

> Tags système créés : Urgent (rouge) · À renouveler (orange) · Archivé (gris) · Confidentiel (noir).
> UNIQUE sur `cabinet_id + name`.

### document_tags
| Colonne | Type | Description |
|---|---|---|
| document_id | uuid FK | |
| tag_id | uuid FK | |

> PK composite `[document_id, tag_id]`.

### export_jobs
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cabinet_id | uuid FK | ← RLS |
| requested_by | uuid FK | |
| status | enum | `PENDING` · `PROCESSING` · `DONE` · `FAILED` · `EXPIRED` |
| storage_path | text | Clé MinIO du ZIP |
| expires_at | timestamptz | now() + 48h quand DONE |
| error | text | |
| created_at | timestamptz | |
| completed_at | timestamptz | |

---

## Règles métier GED

- Document `hosted` → stocké dans MinIO : `cabinets/{cabinet_id}/{uuid}/{filename}`
- Document `external` → URL = `base_url + external_path`
- Un document peut être lié à plusieurs entités via `document_links`
- Item conformité type `doc` soumis → `value = { "document_id": "uuid" }` → pas de doublon
- Dossier système : non supprimable, non renommable par le cabinet
- Tag système : non supprimable, non modifiable par le cabinet
- Export ZIP : job asynchrone Trigger.dev → email quand prêt → lien valide 48h
- Cron quotidien : purge les exports expirés (ZIP MinIO + status = EXPIRED)

---

## Structure ZIP export

```
export_[cabinet]_[date]/
├── index.csv
├── Conformité/
│   ├── Documents réglementaires/
│   └── Justificatifs/
├── Clients/
│   ├── Contrats/
│   └── Pièces d'identité/
├── Formations/
│   └── Attestations/
└── Divers/
```

**index.csv** : nom · dossier · tags · type · taille · date · source · url_externe

---

## Routes API

### Documents
| Méthode | Endpoint | Description |
|---|---|---|
| GET | /api/v1/documents | Liste (cursor) |
| POST | /api/v1/documents | Upload (hosted ou external) |
| GET | /api/v1/documents/:id | Détail |
| PATCH | /api/v1/documents/:id | Modifier (folder_id, tags, nom) |
| DELETE | /api/v1/documents/:id | Soft delete |
| POST | /api/v1/documents/:id/links | Rattacher à une entité |
| DELETE | /api/v1/documents/:id/links/:linkId | Détacher |
| POST | /api/v1/documents/:id/tags | Ajouter tag |
| DELETE | /api/v1/documents/:id/tags/:tagId | Retirer tag |

### Dossiers
| Méthode | Endpoint | Description |
|---|---|---|
| GET | /api/v1/folders | Arborescence complète |
| POST | /api/v1/folders | Créer dossier libre |
| PATCH | /api/v1/folders/:id | Renommer (403 si système) |
| DELETE | /api/v1/folders/:id | Supprimer vide (403 si système) |
| PATCH | /api/v1/folders/:id/move | Déplacer |
| GET | /api/v1/folders/:id/documents | Documents du dossier |

### Tags
| Méthode | Endpoint | Description |
|---|---|---|
| GET | /api/v1/tags | Tags cabinet + système |
| POST | /api/v1/tags | Créer tag libre |
| DELETE | /api/v1/tags/:id | Supprimer (retire de tous les docs) |

### Export
| Méthode | Endpoint | Description |
|---|---|---|
| POST | /api/v1/exports | Déclencher export (retourne job_id) |
| GET | /api/v1/exports | Historique exports |
| GET | /api/v1/exports/:id | Statut + URL signée si DONE |

---

## Pages frontend

| Route | Description |
|---|---|
| /documents | Explorateur GED (arborescence + documents) |
| /documents/tags | Gestion tags du cabinet |
| /parametres (onglet Export) | Historique exports + bouton déclencher |

---

*SPECS_GED v1.2 — à utiliser pour : GED, dossiers, tags, export documents*
