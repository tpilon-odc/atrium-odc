# CGP Platform — Index des Spécifications
> Version 1.2 — Comment utiliser les fichiers SPECS

## Fichiers disponibles

| Fichier | Contenu | Utiliser pour |
|---|---|---|
| `SPECS_CORE.md` | Stack · Principes · Auth · Cabinets · Conventions · Env vars | Toute nouvelle session · Infra · Auth · Onboarding |
| `SPECS_COMPLIANCE.md` | Conformité · Notifications expiration | Module conformité · Job notifications |
| `SPECS_COMMUNITY.md` | Fournisseurs · Produits · Outils · Clusters · Formations · Partage | Modules communautaires · Clusters |
| `SPECS_GED.md` | Documents · Dossiers · Tags · Export ZIP | Module GED · Export données |
| `SPECS_CRM_AGENDA.md` | CRM · Agenda · Notifications in-app · ICS | CRM · Agenda · Calendrier |
| `SPECS_RGPD.md` | RGPD · Consentement · Effacement · Cookies | RGPD · Bandeau cookies |

---

## Comment démarrer une session Claude Code

### Template de prompt minimal
```
Contexte : CGP Platform — Next.js 14 + Fastify + Supabase + Prisma + TypeScript strict.
Relis [SPECS_CORE.md] + [SPECS_XXX.md selon le module].
Tâche : [description précise].
```

### Exemples par tâche

**Corriger un bug auth :**
```
Relis SPECS_CORE.md.
Bug : [description]. Fichier concerné : [chemin].
```

**Travailler sur la conformité :**
```
Relis SPECS_CORE.md + SPECS_COMPLIANCE.md.
Tâche : [description].
```

**Travailler sur la GED :**
```
Relis SPECS_CORE.md + SPECS_GED.md.
Tâche : [description].
```

**Travailler sur les clusters :**
```
Relis SPECS_CORE.md + SPECS_COMMUNITY.md (section Clusters).
Tâche : [description].
```

**Travailler sur le RGPD :**
```
Relis SPECS_CORE.md + SPECS_RGPD.md.
Tâche : [description].
```

---

## Règles absolues à rappeler si besoin

Si Claude Code semble oublier les contraintes, ajoute en fin de prompt :

```
Rappel contraintes absolues :
- cabinet_id toujours extrait du JWT (jamais du body)
- RLS activé sur toutes les tables cabinet
- Soft delete uniquement (deleted_at)
- TypeScript strict, zod sur tous les endpoints
```

---

## Ordre de développement restant

| Étape | Module | Specs |
|---|---|---|
| ✅ 1-13 | Infra · DB · Auth · Cabinets · Conformité · Communauté · CRM · GED · Formations · Partage · Notifications · Agenda · Clusters | Fait |
| 🔲 GED v2 | Dossiers + Tags + Export ZIP | SPECS_GED.md |
| 🔲 RGPD | Consentement + Droits + Cookies | SPECS_RGPD.md |
| 🔲 Tests | RLS · API · E2E · Charge | SPECS_CORE.md |
| 🔲 Déploiement | Coolify + VPS Hetzner | SPECS_CORE.md |
| 🔲 PCA | À spécifier | — |
| 🔲 OAuth2 | Google Calendar + Outlook | SPECS_CRM_AGENDA.md |

---

*Mettre cet index à la racine du repo avec les autres fichiers SPECS_*
