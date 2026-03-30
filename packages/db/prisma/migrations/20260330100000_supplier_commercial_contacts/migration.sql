-- Contacts commerciaux d'un fournisseur, privés par cabinet
CREATE TABLE IF NOT EXISTS supplier_commercial_contacts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id   uuid        NOT NULL REFERENCES cabinets(id) ON DELETE CASCADE,
  supplier_id  uuid        NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  first_name   text        NOT NULL,
  last_name    text        NOT NULL,
  phone        text,
  email        text,
  region       text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scc_cabinet_supplier ON supplier_commercial_contacts(cabinet_id, supplier_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_scc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_scc_updated_at
  BEFORE UPDATE ON supplier_commercial_contacts
  FOR EACH ROW EXECUTE FUNCTION update_scc_updated_at();

-- RLS
ALTER TABLE supplier_commercial_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY scc_cabinet_isolation ON supplier_commercial_contacts
  USING (
    cabinet_id IN (
      SELECT cabinet_id FROM cabinet_members WHERE user_id = auth.uid()::uuid
    )
  );
