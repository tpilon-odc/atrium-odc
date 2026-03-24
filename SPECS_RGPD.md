# CGP Platform — Spécifications RGPD & Cookies
> Version 1.2

## Schéma DB

### consent_records (sur users)
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| version | text | Ex: "CGU-v1.2" |
| accepted_at | timestamptz | |
| ip_address | text | |
| user_agent | text | |

### gdpr_requests
| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| cabinet_id | uuid FK | ← RLS |
| requested_by | uuid FK | |
| type | enum | `ACCESS` · `ERASURE` |
| status | enum | `PENDING` · `PROCESSING` · `DONE` · `REJECTED` |
| message | text | Message optionnel du cabinet |
| processed_by | uuid FK | platform_admin |
| processed_at | timestamptz | |
| response | text | Note interne ou motif rejet |
| export_path | text | Clé MinIO si type ACCESS |
| created_at | timestamptz | |

> RLS : cabinet voit ses demandes · platform_admin voit tout.

---

## Règles métier RGPD

### Consentement
- Enregistré à l'inscription ET à chaque nouvelle version CGU
- Middleware vérifie que l'utilisateur a accepté `CGU_VERSION` courante
- Si non → 403 `CONSENT_REQUIRED` → frontend redirige vers `/consent`

### Droit d'accès (ACCESS)
- Cabinet soumet demande → notification email à toi (GDPR_ADMIN_EMAIL)
- Tu traites manuellement dans `/admin/rgpd`
- Bouton "Générer l'export" → job Trigger.dev → ZIP complet :
  - `donnees/` : cabinet.json · membres.json · conformite.json · contacts.json · interactions.json · fournisseurs.json · produits.json · formations.json · partages.json · consentements.json
  - `documents/` : même arborescence que l'export GED normal
- Email au cabinet avec lien MinIO signé **7 jours** (droit légal)
- Délai max légal : **30 jours** (RGPD art. 12)

### Droit à l'effacement (ERASURE)
- Cabinet soumet demande → tu traites manuellement
- Job Trigger.dev en cascade :
  1. Suppression physique données privées (compliance_answers, cabinet_suppliers, contacts, interactions, trainings, events, notifications, shares, export_jobs, folders)
  2. Suppression fichiers MinIO : `cabinets/{cabinet_id}/`
  3. Anonymisation données communautaires (suppliers/products/tools créés → `created_by = SYSTEM_USER_ID`)
  4. Anonymisation users du cabinet : `email = 'anonyme_[id]@supprime.cgp'` · `is_active = false`
  5. Cabinet : `subscription_status = cancelled` · `deletion_scheduled_at = now()`
  6. Email de confirmation au cabinet
- Cron quotidien : purge définitive cabinets effacés depuis > 30 jours
- **Exception** : `consent_records` conservés même après effacement (obligation légale de preuve)

---

## Routes API

### Consentement
| Méthode | Endpoint | Description |
|---|---|---|
| POST | /api/v1/consent | Enregistrer acceptation |
| GET | /api/v1/consent | Historique consentements |

### Demandes RGPD (cabinet)
| Méthode | Endpoint | Description |
|---|---|---|
| POST | /api/v1/gdpr/requests | Créer demande |
| GET | /api/v1/gdpr/requests | Mes demandes |

### Admin RGPD (platform_admin)
| Méthode | Endpoint | Description |
|---|---|---|
| GET | /api/v1/admin/gdpr/requests | Toutes demandes PENDING |
| PATCH | /api/v1/admin/gdpr/requests/:id | Traiter (DONE/REJECTED) |

---

## Bandeau cookies

- Composant `CookieBanner.tsx` — frontend uniquement, pas de DB
- Stockage : `localStorage` clé `cgp_cookie_consent`
  ```json
  { "accepted": true, "version": "1.0", "date": "2026-03-24T..." }
  ```
- Cookies utilisés (essentiels uniquement) :
  | Nom | Finalité | Durée |
  |---|---|---|
  | sb-access-token | Auth Supabase | Session |
  | sb-refresh-token | Renouvellement | 30 jours |
  | cgp_cookie_consent | Ce choix | 1 an |
- Boutons : Accepter / Refuser / En savoir plus
- "Refuser" : cookies essentiels restent actifs (légalement autorisé)

---

## Pages frontend

| Route | Description |
|---|---|
| /consent | Page acceptation CGU (si CONSENT_REQUIRED) |
| /parametres (onglet Mes données) | Demandes RGPD + droits |
| /admin/rgpd | Interface traitement demandes |
| /legal/privacy | Politique confidentialité (public) |
| /legal/terms | CGU (public) |

---

## Variables d'environnement requises

```env
CGU_VERSION=1.0
PRIVACY_VERSION=1.0
GDPR_ADMIN_EMAIL=ton@email.com
SYSTEM_USER_ID=uuid-du-user-anonyme-systeme
```

---

## Ce qui n'est PAS implémenté (hors scope)
- Registre des traitements → document Word tenu manuellement
- DPIA → à faire avec un juriste
- Notification CNIL en cas de breach → processus manuel

---

*SPECS_RGPD v1.2 — à utiliser pour : RGPD, consentement, effacement, bandeau cookies*
