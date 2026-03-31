-- Migration: collaborator_training_hours
-- Heures par catégorie réglementaire pour une formation suivie

CREATE TABLE collaborator_training_hours (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_record_id UUID NOT NULL REFERENCES collaborator_trainings(id) ON DELETE CASCADE,
  category_id        UUID NOT NULL REFERENCES training_categories(id),
  hours              DOUBLE PRECISION NOT NULL,
  UNIQUE (training_record_id, category_id)
);
