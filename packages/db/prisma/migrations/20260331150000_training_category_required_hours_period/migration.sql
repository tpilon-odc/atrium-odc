-- Remplace annual_hours_required par required_hours + required_hours_period
-- required_hours_period = nombre d'années sur lequel le quota s'applique (ex: 2 = 14h sur 2 ans)

ALTER TABLE training_categories
  RENAME COLUMN annual_hours_required TO required_hours;

ALTER TABLE training_categories
  ADD COLUMN required_hours_period INTEGER DEFAULT 1;
