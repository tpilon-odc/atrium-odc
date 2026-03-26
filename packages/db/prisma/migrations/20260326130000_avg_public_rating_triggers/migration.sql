-- Fonction de recalcul avg_public_rating pour fournisseurs, produits et outils
CREATE OR REPLACE FUNCTION recalc_avg_public_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'supplier_public_ratings' THEN
    IF TG_OP = 'DELETE' THEN target_id := OLD.supplier_id; ELSE target_id := NEW.supplier_id; END IF;
    UPDATE suppliers SET avg_public_rating = (
      SELECT AVG(rating)::FLOAT FROM supplier_public_ratings WHERE supplier_id = target_id
    ) WHERE id = target_id;

  ELSIF TG_TABLE_NAME = 'product_public_ratings' THEN
    IF TG_OP = 'DELETE' THEN target_id := OLD.product_id; ELSE target_id := NEW.product_id; END IF;
    UPDATE products SET avg_public_rating = (
      SELECT AVG(rating)::FLOAT FROM product_public_ratings WHERE product_id = target_id
    ) WHERE id = target_id;

  ELSIF TG_TABLE_NAME = 'tool_public_ratings' THEN
    IF TG_OP = 'DELETE' THEN target_id := OLD.tool_id; ELSE target_id := NEW.tool_id; END IF;
    UPDATE tools SET avg_public_rating = (
      SELECT AVG(rating)::FLOAT FROM tool_public_ratings WHERE tool_id = target_id
    ) WHERE id = target_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_avg_rating_supplier ON supplier_public_ratings;
CREATE TRIGGER trg_avg_rating_supplier
  AFTER INSERT OR UPDATE OR DELETE ON supplier_public_ratings
  FOR EACH ROW EXECUTE FUNCTION recalc_avg_public_rating();

DROP TRIGGER IF EXISTS trg_avg_rating_product ON product_public_ratings;
CREATE TRIGGER trg_avg_rating_product
  AFTER INSERT OR UPDATE OR DELETE ON product_public_ratings
  FOR EACH ROW EXECUTE FUNCTION recalc_avg_public_rating();

DROP TRIGGER IF EXISTS trg_avg_rating_tool ON tool_public_ratings;
CREATE TRIGGER trg_avg_rating_tool
  AFTER INSERT OR UPDATE OR DELETE ON tool_public_ratings
  FOR EACH ROW EXECUTE FUNCTION recalc_avg_public_rating();
