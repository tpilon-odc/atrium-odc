-- Migration: training_categories
-- Catégories de formations paramétrables par l'administrateur plateforme

CREATE TABLE training_categories (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      TEXT NOT NULL,
  code      TEXT NOT NULL UNIQUE,
  "order"   INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Catégories initiales (réglementation CGP française)
INSERT INTO training_categories (name, code, "order") VALUES
  ('IAS (Intermédiaire en Assurance)',            'ias',         1),
  ('CIF (Conseiller en Investissements Financiers)', 'cif',      2),
  ('IOBSP (Intermédiaire en Opérations Bancaires)', 'iobsp',     3),
  ('Immobilier / ICCI',                           'immobilier',  4),
  ('IFP (Intermédiaire en Financement Participatif)', 'ifp',     5),
  ('DDA (Distribution Directive Assurance)',       'dda',        6),
  ('Autre',                                       'autre',       99);

-- Colonne FK sur training_catalog
ALTER TABLE training_catalog ADD COLUMN category_id UUID REFERENCES training_categories(id);
