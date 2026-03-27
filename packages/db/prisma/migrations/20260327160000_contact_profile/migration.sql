-- Migration : cabinet_contact_profile (profil MiFID II par contact)

-- Trigger function (idempotent)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TABLE IF EXISTS cabinet_contact_profile CASCADE;

CREATE TABLE cabinet_contact_profile (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id                 uuid NOT NULL REFERENCES cabinets(id),
  contact_id                 uuid NOT NULL REFERENCES contacts(id),

  -- AXE 1 — Type de client
  classification_mifid       text CHECK (classification_mifid IN (
    'non_professionnel',
    'professionnel',
    'contrepartie_eligible'
  )),

  -- AXE 2 — Connaissance et expérience
  connaissance               text CHECK (connaissance IN ('basique', 'informe', 'expert')),
  experience                 text CHECK (experience IN ('faible', 'moyenne', 'elevee')),

  -- AXE 3 — Capacité à supporter des pertes
  capacite_pertes            text CHECK (capacite_pertes IN (
    'aucune',
    'limitee',
    'capital',
    'superieure'
  )),

  -- AXE 4 — Tolérance au risque (SRI 1→7)
  sri                        int CHECK (sri BETWEEN 1 AND 7),

  -- AXE 5 — Objectifs et besoins
  horizon                    text CHECK (horizon IN ('moins_2_ans', '2_5_ans', 'plus_5_ans')),
  objectifs                  text[] NOT NULL DEFAULT '{}',

  -- Préférences de durabilité
  a_preferences_durabilite   boolean NOT NULL DEFAULT false,
  pct_taxonomie_souhaite     float CHECK (pct_taxonomie_souhaite BETWEEN 0 AND 1),
  pct_sfdr_env_souhaite      float CHECK (pct_sfdr_env_souhaite BETWEEN 0 AND 1),
  pct_sfdr_social_souhaite   float CHECK (pct_sfdr_social_souhaite BETWEEN 0 AND 1),
  pai_ges_societes           boolean NOT NULL DEFAULT false,
  pai_biodiversite           boolean NOT NULL DEFAULT false,
  pai_eau                    boolean NOT NULL DEFAULT false,
  pai_dechets                boolean NOT NULL DEFAULT false,
  pai_social_personnel       boolean NOT NULL DEFAULT false,
  pai_ges_souverains         boolean NOT NULL DEFAULT false,
  pai_normes_sociales        boolean NOT NULL DEFAULT false,
  pai_combustibles_fossiles  boolean NOT NULL DEFAULT false,
  pai_immobilier_energetique boolean NOT NULL DEFAULT false,

  -- Métadonnées
  notes                      text,
  profil_date                date NOT NULL DEFAULT CURRENT_DATE,
  next_review_date           date,
  status                     text NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'archived')),

  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE cabinet_contact_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cabinet_contact_profile_select" ON cabinet_contact_profile
  FOR SELECT USING (cabinet_id = auth.uid()::uuid);

CREATE POLICY "cabinet_contact_profile_insert" ON cabinet_contact_profile
  FOR INSERT WITH CHECK (cabinet_id = auth.uid()::uuid);

CREATE POLICY "cabinet_contact_profile_update" ON cabinet_contact_profile
  FOR UPDATE USING (cabinet_id = auth.uid()::uuid);

CREATE POLICY "cabinet_contact_profile_admin" ON cabinet_contact_profile
  USING (auth.jwt() ->> 'global_role' = 'platform_admin');

-- Trigger
CREATE TRIGGER set_updated_at_cabinet_contact_profile
  BEFORE UPDATE ON cabinet_contact_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_ccp_cabinet_id ON cabinet_contact_profile(cabinet_id);
CREATE INDEX idx_ccp_contact_id ON cabinet_contact_profile(contact_id);
CREATE INDEX idx_ccp_status ON cabinet_contact_profile(status);
CREATE INDEX idx_ccp_next_review ON cabinet_contact_profile(next_review_date);
