-- Règles de classement automatique des documents par contexte d'upload
CREATE TABLE folder_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id  UUID NOT NULL REFERENCES cabinets(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,  -- 'contact' | 'supplier' | 'product' | 'training' | 'compliance_answer'
  folder_id   UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (cabinet_id, entity_type)
);

CREATE INDEX idx_folder_rules_cabinet ON folder_rules(cabinet_id);
