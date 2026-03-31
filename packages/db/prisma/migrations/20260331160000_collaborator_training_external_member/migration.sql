-- Permet d'associer une formation à un membre externe (sans compte plateforme)
-- userId devient nullable, memberId est ajouté comme référence au CabinetMember

ALTER TABLE collaborator_trainings
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE collaborator_trainings
  ADD COLUMN member_id UUID REFERENCES cabinet_members(id);

CREATE INDEX ON collaborator_trainings(member_id);
