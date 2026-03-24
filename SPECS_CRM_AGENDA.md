# CGP Platform — Spécifications CRM & Agenda
> Version 1.2

## CRM

### contacts
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cabinet_id | uuid FK | ← RLS |
| first_name | text | |
| last_name | text NOT NULL | |
| email | text | |
| phone | text | |
| type | enum | `prospect` · `client` · `ancien_client` |
| metadata | jsonb | Champs libres |
| created_at | timestamptz | |

### interactions
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| contact_id | uuid FK | |
| user_id | uuid FK | |
| type | enum | `email` · `appel` · `rdv` · `note` |
| note | text | |
| occurred_at | timestamptz | |

## Routes API CRM
| Méthode | Endpoint | Description |
|---|---|---|
| GET | /api/v1/contacts | Liste (cursor + search) |
| POST | /api/v1/contacts | Créer |
| GET | /api/v1/contacts/:id | Détail + interactions |
| PATCH | /api/v1/contacts/:id | Modifier |
| DELETE | /api/v1/contacts/:id | Soft delete |
| GET | /api/v1/contacts/:id/interactions | Historique |
| POST | /api/v1/contacts/:id/interactions | Ajouter interaction |

---

## Agenda

### events
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cabinet_id | uuid FK | ← RLS |
| created_by | uuid FK | |
| contact_id | uuid FK | Optionnel — lié CRM |
| title | text NOT NULL | |
| description | text | |
| type | enum | `RDV` · `CALL` · `TASK` · `COMPLIANCE` |
| status | enum | `PLANNED` · `DONE` · `CANCELLED` |
| start_at | timestamptz NOT NULL | |
| end_at | timestamptz NOT NULL | |
| all_day | boolean | Default false |
| location | text | |
| compliance_answer_id | uuid FK | Auto — trigger Postgres |
| is_recurring | boolean | Default false |
| recurrence_rule | text | RRULE format |
| deleted_at | timestamptz | Soft delete |
| created_at | timestamptz | |
| updated_at | timestamptz | |

> Events `COMPLIANCE` créés automatiquement par trigger Postgres à la soumission d'une réponse avec `expires_at`.
> Events `COMPLIANCE` non modifiables ni supprimables manuellement (403).

### notifications (in-app)
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cabinet_id | uuid FK | ← RLS |
| user_id | uuid FK | ← RLS (user_id = auth.uid()) |
| type | text | `compliance_expiring` · `compliance_expired` |
| title | text NOT NULL | |
| message | text NOT NULL | |
| entity_type | text | |
| entity_id | uuid | |
| is_read | boolean | Default false |
| created_at | timestamptz | |

## Flux ICS (synchronisation)
- Endpoint public : `GET /api/v1/calendar/:cabinet_id/feed.ics?token=XXX`
- Protégé par `ics_token` unique sur `cabinets`
- Compatible Google Calendar, Outlook, Apple Calendar
- Cache serveur 15 min (`Cache-Control: max-age=900`)
- Token régénérable depuis les paramètres
- OAuth2 Google/Outlook → phase 2 post-pilotes

## Routes API Agenda
| Méthode | Endpoint | Description |
|---|---|---|
| GET | /api/v1/events | Events par plage de dates + filtres |
| GET | /api/v1/events/upcoming | 10 prochains |
| POST | /api/v1/events | Créer |
| PATCH | /api/v1/events/:id | Modifier (403 si COMPLIANCE) |
| DELETE | /api/v1/events/:id | Soft delete (403 si COMPLIANCE) |
| PATCH | /api/v1/events/:id/status | Changer statut |
| GET | /api/v1/calendar/:id/feed.ics | Flux ICS public |
| POST | /api/v1/calendar/regenerate-token | Nouveau token ICS |

## Routes API Notifications
| Méthode | Endpoint | Description |
|---|---|---|
| GET | /api/v1/notifications | Non lues par défaut |
| PATCH | /api/v1/notifications/:id/read | Marquer lue |
| PATCH | /api/v1/notifications/read-all | Tout lire |

## Pages frontend
| Route | Description |
|---|---|
| /crm | Contacts + pipeline |
| /crm/contacts/:id | Fiche contact + interactions + agenda |
| /agenda | FullCalendar (jour/semaine/mois/liste) |
| /notifications | Liste complète notifications |
| /parametres (onglet Agenda) | Lien ICS + instructions sync |

## Règles métier agenda
- Drag & drop → PATCH automatique `start_at/end_at`
- Polling notifications : 30s (COUNT uniquement si dropdown fermé)
- Clic notification → navigue vers `/conformite#item-{entity_id}` + marque lue
- FullCalendar v6 MIT uniquement — ne pas upgrader vers premium

---

*SPECS_CRM_AGENDA v1.2 — à utiliser pour : CRM, agenda, notifications in-app, flux ICS*
