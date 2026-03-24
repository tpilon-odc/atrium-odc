-- Prisma se connecte en tant que rôle "postgres" (superuser local Supabase).
-- Ce rôle doit pouvoir bypasser RLS pour que l'API fonctionne correctement.
-- La sécurité est assurée par notre authMiddleware (JWT), pas par RLS côté API.

ALTER ROLE postgres BYPASSRLS;
