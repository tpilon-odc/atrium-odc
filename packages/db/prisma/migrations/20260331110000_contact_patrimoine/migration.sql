-- Migration: contact_patrimoine
-- Actifs, passifs, revenus et fiscalité par contact

CREATE TABLE contact_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id      UUID NOT NULL REFERENCES cabinets(id),
  contact_id      UUID NOT NULL REFERENCES contacts(id),
  type            TEXT NOT NULL,
  label           TEXT NOT NULL,
  estimated_value DOUBLE PRECISION NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contact_assets ON contact_assets(cabinet_id, contact_id);

CREATE TABLE contact_liabilities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id        UUID NOT NULL REFERENCES cabinets(id),
  contact_id        UUID NOT NULL REFERENCES contacts(id),
  type              TEXT NOT NULL,
  label             TEXT NOT NULL,
  outstanding_amount DOUBLE PRECISION NOT NULL,
  monthly_payment   DOUBLE PRECISION,
  end_date          DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contact_liabilities ON contact_liabilities(cabinet_id, contact_id);

CREATE TABLE contact_incomes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id    UUID NOT NULL REFERENCES cabinets(id),
  contact_id    UUID NOT NULL REFERENCES contacts(id),
  type          TEXT NOT NULL,
  label         TEXT NOT NULL,
  annual_amount DOUBLE PRECISION NOT NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contact_incomes ON contact_incomes(cabinet_id, contact_id);

CREATE TABLE contact_taxes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id  UUID NOT NULL REFERENCES cabinets(id),
  contact_id  UUID NOT NULL REFERENCES contacts(id),
  tmi         DOUBLE PRECISION,
  regime      TEXT,
  pfu_option  BOOLEAN NOT NULL DEFAULT false,
  ifi         BOOLEAN NOT NULL DEFAULT false,
  ifi_value   DOUBLE PRECISION,
  notes       TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cabinet_id, contact_id)
);
