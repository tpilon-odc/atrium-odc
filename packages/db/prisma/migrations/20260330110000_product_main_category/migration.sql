-- Catégorie principale réglementaire du produit
-- null = non défini, 'assurance' ou 'cif'
ALTER TABLE products ADD COLUMN IF NOT EXISTS main_category text
  CHECK (main_category IN ('assurance', 'cif'));
