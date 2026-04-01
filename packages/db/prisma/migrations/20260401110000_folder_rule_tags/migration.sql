-- Tags automatiques configurables par règle de classement
CREATE TYPE folder_rule_tag_type AS ENUM ('fixed', 'year', 'entity_name');

CREATE TABLE folder_rule_tags (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_rule_id UUID NOT NULL REFERENCES folder_rules(id) ON DELETE CASCADE,
  type           folder_rule_tag_type NOT NULL,
  fixed_value    TEXT,  -- utilisé si type = 'fixed'
  "order"        INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_fixed_value CHECK (
    (type = 'fixed' AND fixed_value IS NOT NULL AND fixed_value <> '')
    OR (type <> 'fixed')
  )
);

CREATE INDEX idx_folder_rule_tags_rule ON folder_rule_tags(folder_rule_id);
