-- Sous-catégories produit configurables par catégorie principale
CREATE TABLE IF NOT EXISTS product_subcategories (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  main_category text   NOT NULL CHECK (main_category IN ('assurance', 'cif')),
  label        text    NOT NULL,
  "order"      integer NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (main_category, label)
);

-- Données initiales
INSERT INTO product_subcategories (main_category, label, "order") VALUES
  ('assurance', 'Assurance-vie', 1),
  ('assurance', 'PER (assurance)', 2),
  ('assurance', 'Prévoyance', 3),
  ('assurance', 'Santé / Mutuelle', 4),
  ('assurance', 'IARD', 5),
  ('cif', 'Actions', 1),
  ('cif', 'Obligations', 2),
  ('cif', 'OPCVM', 3),
  ('cif', 'SCPI', 4),
  ('cif', 'PER (bancaire)', 5),
  ('cif', 'Défiscalisation', 6),
  ('cif', 'Private Equity', 7)
ON CONFLICT DO NOTHING;
