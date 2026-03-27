-- Module gouvernance des produits financiers MiFID II
-- Table privée par cabinet : cabinet_product_governance

CREATE TABLE cabinet_product_governance (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id                  uuid NOT NULL REFERENCES cabinets(id),
  product_id                  uuid NOT NULL REFERENCES products(id),

  -- AXE 1 — Type de client
  client_non_professionnel    text CHECK (client_non_professionnel IN ('positif', 'neutre', 'negatif')),
  client_professionnel        text CHECK (client_professionnel IN ('positif', 'neutre', 'negatif')),

  -- AXE 2 — Connaissance et expérience
  connaissance_basique        text CHECK (connaissance_basique IN ('positif', 'neutre', 'negatif')),
  connaissance_informe        text CHECK (connaissance_informe IN ('positif', 'neutre', 'negatif')),
  connaissance_expert         text CHECK (connaissance_expert IN ('positif', 'neutre', 'negatif')),
  experience_faible           text CHECK (experience_faible IN ('positif', 'neutre', 'negatif')),
  experience_moyenne          text CHECK (experience_moyenne IN ('positif', 'neutre', 'negatif')),
  experience_elevee           text CHECK (experience_elevee IN ('positif', 'neutre', 'negatif')),

  -- AXE 3 — Capacité à supporter des pertes
  perte_aucune                text CHECK (perte_aucune IN ('positif', 'neutre', 'negatif')),
  perte_limitee               text CHECK (perte_limitee IN ('positif', 'neutre', 'negatif')),
  perte_capital               text CHECK (perte_capital IN ('positif', 'neutre', 'negatif')),
  perte_superieure_capital    text CHECK (perte_superieure_capital IN ('positif', 'neutre', 'negatif')),

  -- AXE 4 — Tolérance au risque (indicateur SRI 1→7)
  risque_1                    text CHECK (risque_1 IN ('positif', 'neutre', 'negatif')),
  risque_2_3                  text CHECK (risque_2_3 IN ('positif', 'neutre', 'negatif')),
  risque_4                    text CHECK (risque_4 IN ('positif', 'neutre', 'negatif')),
  risque_5_6                  text CHECK (risque_5_6 IN ('positif', 'neutre', 'negatif')),
  risque_7                    text CHECK (risque_7 IN ('positif', 'neutre', 'negatif')),

  -- AXE 5 — Objectifs et besoins
  horizon_moins_2_ans         text CHECK (horizon_moins_2_ans IN ('positif', 'neutre', 'negatif')),
  horizon_2_5_ans             text CHECK (horizon_2_5_ans IN ('positif', 'neutre', 'negatif')),
  horizon_plus_5_ans          text CHECK (horizon_plus_5_ans IN ('positif', 'neutre', 'negatif')),
  objectif_preservation       text CHECK (objectif_preservation IN ('positif', 'neutre', 'negatif')),
  objectif_croissance         text CHECK (objectif_croissance IN ('positif', 'neutre', 'negatif')),
  objectif_revenus            text CHECK (objectif_revenus IN ('positif', 'neutre', 'negatif')),
  objectif_fiscal             text CHECK (objectif_fiscal IN ('positif', 'neutre', 'negatif')),

  -- Durabilité — pourcentages
  pct_taxonomie               float CHECK (pct_taxonomie BETWEEN 0 AND 1),
  pct_sfdr_environnemental    float CHECK (pct_sfdr_environnemental BETWEEN 0 AND 1),
  pct_sfdr_social             float CHECK (pct_sfdr_social BETWEEN 0 AND 1),

  -- PAI — sociétés
  pai_ges_societes            boolean NOT NULL DEFAULT false,
  pai_biodiversite            boolean NOT NULL DEFAULT false,
  pai_eau                     boolean NOT NULL DEFAULT false,
  pai_dechets                 boolean NOT NULL DEFAULT false,
  pai_social_personnel        boolean NOT NULL DEFAULT false,
  -- PAI — actifs souverains
  pai_ges_souverains          boolean NOT NULL DEFAULT false,
  pai_normes_sociales         boolean NOT NULL DEFAULT false,
  -- PAI — actifs immobiliers
  pai_combustibles_fossiles   boolean NOT NULL DEFAULT false,
  pai_immobilier_energetique  boolean NOT NULL DEFAULT false,

  durabilite_communiquee      boolean NOT NULL DEFAULT true,

  -- Métadonnées
  producteur_soumis_mif2      boolean NOT NULL DEFAULT true,
  marche_cible_source         text,

  -- Révision
  revision_date               date NOT NULL DEFAULT CURRENT_DATE,
  next_revision_date          date,
  notes_revision              text,

  -- Statut
  status                      text NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'active', 'archived')),

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_cabinet_product
    FOREIGN KEY (cabinet_id, product_id)
    REFERENCES cabinet_products(cabinet_id, product_id)
);

-- RLS
ALTER TABLE cabinet_product_governance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cpg_select" ON cabinet_product_governance
  FOR SELECT USING (cabinet_id = auth.uid()::uuid);

CREATE POLICY "cpg_insert" ON cabinet_product_governance
  FOR INSERT WITH CHECK (cabinet_id = auth.uid()::uuid);

CREATE POLICY "cpg_update" ON cabinet_product_governance
  FOR UPDATE USING (cabinet_id = auth.uid()::uuid);

CREATE POLICY "cpg_admin" ON cabinet_product_governance
  USING ((auth.jwt() ->> 'global_role') = 'platform_admin');

-- Trigger updated_at
CREATE TRIGGER set_updated_at_cpg
  BEFORE UPDATE ON cabinet_product_governance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index
CREATE INDEX idx_cpg_cabinet_id ON cabinet_product_governance(cabinet_id);
CREATE INDEX idx_cpg_product_id ON cabinet_product_governance(product_id);
CREATE INDEX idx_cpg_next_revision ON cabinet_product_governance(next_revision_date);
CREATE INDEX idx_cpg_status ON cabinet_product_governance(status);
CREATE INDEX idx_cpg_cabinet_product_status ON cabinet_product_governance(cabinet_id, product_id, status);

-- Vue : gouvernance active par cabinet+produit
CREATE VIEW v_cabinet_product_governance_active AS
SELECT DISTINCT ON (cabinet_id, product_id)
  cpg.*,
  p.name AS product_name,
  p.category AS product_category
FROM cabinet_product_governance cpg
JOIN products p ON p.id = cpg.product_id
WHERE cpg.status = 'active'
ORDER BY cabinet_id, product_id, revision_date DESC;
