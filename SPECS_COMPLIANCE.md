# CGP Platform — Spécifications Conformité
> Version 1.2

## Schéma DB

### compliance_phases
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| label | text NOT NULL | Ex: "Identification du cabinet" |
| description | text | |
| order | int NOT NULL | Non bloquant |
| is_active | boolean | Default true |
| created_at | timestamptz | |

> Géré uniquement par `platform_admin`. Les cabinets ne peuvent pas modifier.

### compliance_items
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| phase_id | uuid FK | |
| label | text NOT NULL | |
| type | enum | `doc` · `text` · `radio` · `checkbox` |
| config | jsonb NOT NULL | Voir structure ci-dessous |
| is_required | boolean | Default true |
| validity_months | int | NULL = pas d'expiration |
| alert_before_days | int[] | Ex: `{30,7}` |
| due_days_after_signup | int | |
| order | int NOT NULL | |

```json
doc      → { "formats": ["pdf","jpg","png"], "max_mb": 10 }
text     → { "placeholder": "...", "max_length": 500 }
radio    → { "options": ["A", "B", "C"] }
checkbox → { "options": ["A", "B", "C"] }
```

### compliance_conditions
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| item_id | uuid FK | Item conditionné |
| depends_on_item_id | uuid FK | Item évalué |
| operator | enum | `eq` · `not_eq` · `in` · `not_in` |
| expected_value | text | |

### cabinet_compliance_answers
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cabinet_id | uuid FK | ← RLS |
| item_id | uuid FK | |
| answered_by | uuid FK | |
| value | jsonb NOT NULL | |
| status | enum | `draft` · `submitted` |
| submitted_at | timestamptz | |
| expires_at | timestamptz | submitted_at + validity_months |
| updated_at | timestamptz | Auto trigger |

```json
doc      → { "document_id": "uuid" }
text     → { "text": "..." }
radio    → { "selected": ["Option A"] }
checkbox → { "selected": ["A", "C"] }
```

**Statuts calculés (non stockés) :**
```
not_started   → aucune réponse
submitted     → status=submitted ET (expires_at IS NULL OR expires_at > now())
expiring_soon → expires_at BETWEEN now() AND now() + INTERVAL '30 days'
expired       → expires_at < now() → compte comme not_started
```

### compliance_notifications
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cabinet_id | uuid FK | ← RLS |
| answer_id | uuid FK | |
| days_before | int | Palier déclencheur |
| channel | enum | `email` · `in_app` |
| sent_at | timestamptz | Anti-doublon |

---

## Règles métier

- Phases ordonnées mais **non bloquantes** — cabinet remplit dans n'importe quel ordre
- Progression phase = `items complétés / items required * 100`
- Item expiré → repasse en `not_started` dans la progression
- Job Trigger.dev chaque nuit à 6h UTC :
  - Cherche answers où `EXTRACT(DAY FROM (expires_at - now())) = ANY(alert_before_days)`
  - Vérifie absence de doublon dans `compliance_notifications` (même `answer_id + days_before` dans les 24h)
  - Envoie email + notification in-app

---

## Routes API

| Méthode | Endpoint | Description |
|---|---|---|
| GET | /api/v1/compliance/phases | Liste phases actives |
| POST | /api/v1/compliance/phases | Créer phase (admin) |
| PATCH | /api/v1/compliance/phases/:id | Modifier (admin) |
| DELETE | /api/v1/compliance/phases/:id | Supprimer (admin) |
| GET | /api/v1/compliance/items | Items d'une phase |
| POST | /api/v1/compliance/items | Créer item (admin) |
| PATCH | /api/v1/compliance/items/:id | Modifier (admin) |
| DELETE | /api/v1/compliance/items/:id | Supprimer (admin) |
| GET | /api/v1/compliance/answers | Réponses du cabinet |
| POST | /api/v1/compliance/answers | Soumettre réponse |
| GET | /api/v1/compliance/progress | Progression par phase |

---

## Pages Frontend

| Route | Description |
|---|---|
| /conformite | Vue progression cabinet (phases + items) |
| /admin/conformite | Gestion phases/items (platform_admin) |
| /admin/conformite/[phaseId] | Items d'une phase |

---

*SPECS_COMPLIANCE v1.2 — à utiliser pour : conformité, notifications expiration*
