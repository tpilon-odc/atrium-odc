-- Ajoute compliance_item à l'enum ShareEntityType
-- pour permettre le partage d'items de conformité individuels
-- à destination des chambers / régulateurs de la plateforme.

ALTER TYPE "ShareEntityType" ADD VALUE IF NOT EXISTS 'compliance_item';
