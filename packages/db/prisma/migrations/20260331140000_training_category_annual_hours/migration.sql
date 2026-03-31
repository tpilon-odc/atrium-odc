-- Migration: training_category_annual_hours
-- Quota annuel d'heures par catégorie de formation

ALTER TABLE training_categories
  ADD COLUMN annual_hours_required DOUBLE PRECISION;
