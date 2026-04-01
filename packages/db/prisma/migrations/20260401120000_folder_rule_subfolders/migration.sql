-- Sous-dossiers automatiques sur les règles de classement
ALTER TABLE folder_rules
  ADD COLUMN subfolder_entity  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN subfolder_year    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN subfolder_order   TEXT    NOT NULL DEFAULT 'entity_year'
    CHECK (subfolder_order IN ('entity_year', 'year_entity'));
