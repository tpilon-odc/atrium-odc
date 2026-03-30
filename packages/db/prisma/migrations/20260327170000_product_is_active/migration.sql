-- Statut de commercialisation du produit par le fournisseur
-- true (défaut) = produit toujours commercialisé
-- false = produit retiré / clôturé par le fournisseur
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
