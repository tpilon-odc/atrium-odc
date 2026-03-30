-- Configuration des axes de gouvernance produit par catégorie principale
-- Permet de paramétrer les axes MiFID II (CIF) vs DDA (Assurance) différemment

CREATE TABLE IF NOT EXISTS governance_axis_configs (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  main_category text    NOT NULL CHECK (main_category IN ('assurance', 'cif')),
  axis_id       text    NOT NULL,  -- ex: 'type_client', 'connaissance_experience', …
  label         text    NOT NULL,
  description   text    NOT NULL DEFAULT '',
  criteria      jsonb   NOT NULL DEFAULT '[]',  -- [{field, label, sublabel?}]
  is_enabled    boolean NOT NULL DEFAULT true,
  "order"       integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (main_category, axis_id)
);

CREATE INDEX IF NOT EXISTS idx_gac_main_category ON governance_axis_configs(main_category, "order");

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_gac_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gac_updated_at
  BEFORE UPDATE ON governance_axis_configs
  FOR EACH ROW EXECUTE FUNCTION update_gac_updated_at();

-- Données initiales — CIF (MiFID II, axes standards)
INSERT INTO governance_axis_configs (main_category, axis_id, label, description, criteria, "order") VALUES
('cif', 'type_client', '1. Type de client',
 'Catégorie de client au sens MiFID II à qui le produit est destiné.',
 '[
   {"field":"clientNonProfessionnel","label":"Client non professionnel"},
   {"field":"clientProfessionnel","label":"Client professionnel ou contrepartie éligible"}
 ]'::jsonb, 1),
('cif', 'connaissance_experience', '2. Connaissance et expérience',
 'Niveau de connaissance et d''expérience des produits financiers que doivent avoir les clients ciblés.',
 '[
   {"field":"connaissanceBasique","label":"Connaissance","sublabel":"Basique"},
   {"field":"connaissanceInforme","label":"Connaissance","sublabel":"Informé"},
   {"field":"connaissanceExpert","label":"Connaissance","sublabel":"Expert"},
   {"field":"experienceFaible","label":"Expérience","sublabel":"Faible"},
   {"field":"experienceMoyenne","label":"Expérience","sublabel":"Moyenne"},
   {"field":"experienceElevee","label":"Expérience","sublabel":"Élevée"}
 ]'::jsonb, 2),
('cif', 'capacite_pertes', '3. Capacité à supporter des pertes',
 'Montant des pertes que les clients ciblés peuvent supporter.',
 '[
   {"field":"perteAucune","label":"Aucune perte en capital"},
   {"field":"perteLimitee","label":"Pertes en capital limitées"},
   {"field":"perteCapital","label":"Perte du capital investi"},
   {"field":"perteSuperieurCapital","label":"Pertes supérieures au capital investi"}
 ]'::jsonb, 3),
('cif', 'tolerance_risque', '4. Tolérance au risque',
 'Attitude vis-à-vis du risque, classée par indicateur SRI (issu du DIC PRIIPS).',
 '[
   {"field":"risque1","label":"Très faible","sublabel":"Indicateur de risque : 1"},
   {"field":"risque23","label":"Faible","sublabel":"Indicateur de risque : 2 à 3"},
   {"field":"risque4","label":"Moyenne","sublabel":"Indicateur de risque : 4"},
   {"field":"risque56","label":"Élevée","sublabel":"Indicateur de risque : 5 à 6"},
   {"field":"risque7","label":"Très élevée","sublabel":"Indicateur de risque : 7"}
 ]'::jsonb, 4),
('cif', 'objectifs_besoins', '5. Objectifs et besoins',
 'Horizon de placement et objectifs d''investissement des clients ciblés.',
 '[
   {"field":"horizonMoins2Ans","label":"Horizon de placement","sublabel":"Inférieur à 2 ans"},
   {"field":"horizon25Ans","label":"Horizon de placement","sublabel":"Entre 2 et 5 ans"},
   {"field":"horizonPlus5Ans","label":"Horizon de placement","sublabel":"Supérieur à 5 ans"},
   {"field":"objectifPreservation","label":"Objectif","sublabel":"Préservation du capital"},
   {"field":"objectifCroissance","label":"Objectif","sublabel":"Croissance du capital"},
   {"field":"objectifRevenus","label":"Objectif","sublabel":"Revenus complémentaires"},
   {"field":"objectifFiscal","label":"Objectif","sublabel":"Avantage fiscal"}
 ]'::jsonb, 5)
ON CONFLICT DO NOTHING;

-- Données initiales — Assurance (DDA)
INSERT INTO governance_axis_configs (main_category, axis_id, label, description, criteria, "order") VALUES
('assurance', 'type_client', '1. Type de client',
 'Catégorie de client au sens de la DDA à qui le produit est destiné.',
 '[
   {"field":"clientNonProfessionnel","label":"Client particulier (non professionnel)"},
   {"field":"clientProfessionnel","label":"Client professionnel"}
 ]'::jsonb, 1),
('assurance', 'connaissance_experience', '2. Connaissance et expérience',
 'Niveau de connaissance des produits d''assurance que doivent avoir les clients ciblés.',
 '[
   {"field":"connaissanceBasique","label":"Connaissance","sublabel":"Basique"},
   {"field":"connaissanceInforme","label":"Connaissance","sublabel":"Informé"},
   {"field":"connaissanceExpert","label":"Connaissance","sublabel":"Expert"}
 ]'::jsonb, 2),
('assurance', 'capacite_pertes', '3. Capacité à supporter des pertes',
 'Capacité financière du client à faire face à une perte.',
 '[
   {"field":"perteAucune","label":"Aucune perte acceptée"},
   {"field":"perteLimitee","label":"Perte limitée acceptable"},
   {"field":"perteCapital","label":"Perte totale du capital possible"}
 ]'::jsonb, 3),
('assurance', 'objectifs_besoins', '4. Objectifs et besoins',
 'Horizon de placement et objectifs d''épargne ou de protection des clients ciblés.',
 '[
   {"field":"horizonMoins2Ans","label":"Horizon","sublabel":"Court terme (< 2 ans)"},
   {"field":"horizon25Ans","label":"Horizon","sublabel":"Moyen terme (2 à 5 ans)"},
   {"field":"horizonPlus5Ans","label":"Horizon","sublabel":"Long terme (> 5 ans)"},
   {"field":"objectifPreservation","label":"Objectif","sublabel":"Protection / Prévoyance"},
   {"field":"objectifCroissance","label":"Objectif","sublabel":"Épargne / Croissance"},
   {"field":"objectifRevenus","label":"Objectif","sublabel":"Revenus complémentaires"},
   {"field":"objectifFiscal","label":"Objectif","sublabel":"Avantage fiscal"}
 ]'::jsonb, 4)
ON CONFLICT DO NOTHING;

-- Note: l'axe 'tolerance_risque' (SRI) est absent de l'Assurance par défaut car le SRI
-- n'est pas applicable aux produits d'assurance vie (pas de DIC PRIIPS obligatoire).
-- Il peut être activé manuellement depuis l'interface d'administration.
