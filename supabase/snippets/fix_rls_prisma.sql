-- Prisma se connecte en tant que rôle "postgres" (superuser local Supabase).
-- Ce rôle doit pouvoir bypasser RLS pour que l'API fonctionne correctement.
-- La sécurité est assurée par notre authMiddleware (JWT), pas par RLS côté API.
--
-- Les politiques RLS (migration 20260402100000_rls_policies) s'appliquent aux
-- appels Supabase JS directs (dashboard Studio, portail fournisseur, etc.).
-- Prisma en tant que postgres les bypasse entièrement.

ALTER ROLE postgres BYPASSRLS;
