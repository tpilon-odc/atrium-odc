-- Migration: patrimoine_asset_links
-- Permet de lier un passif ou un revenu à un actif du contact

ALTER TABLE contact_liabilities
  ADD COLUMN asset_id UUID REFERENCES contact_assets(id) ON DELETE SET NULL;

ALTER TABLE contact_incomes
  ADD COLUMN asset_id UUID REFERENCES contact_assets(id) ON DELETE SET NULL;
