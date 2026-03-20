-- =============================================================================
-- TRIGGERS — CGP Platform
-- À appliquer après rls_policies.sql
-- psql $DATABASE_URL -f packages/db/sql/triggers.sql
-- =============================================================================

-- =============================================================================
-- 1. SYNC auth.users → public.users
--    Crée automatiquement un profil public quand un utilisateur s'inscrit
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, global_role, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE((NEW.raw_app_meta_data ->> 'global_role')::public."GlobalRole", 'cabinet_user'),
    NEW.created_at
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 2. UPDATED_AT automatique
--    Fonction générique réutilisée sur toutes les tables concernées
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Appliquer sur cabinet_compliance_answers (Prisma @updatedAt le gère aussi,
-- le trigger est une sécurité pour les updates SQL directs)
DROP TRIGGER IF EXISTS set_updated_at_compliance_answers ON public.cabinet_compliance_answers;
CREATE TRIGGER set_updated_at_compliance_answers
  BEFORE UPDATE ON public.cabinet_compliance_answers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Appliquer sur supplier_public_ratings / product_public_ratings / tool_public_ratings
DROP TRIGGER IF EXISTS set_updated_at_supplier_ratings ON public.supplier_public_ratings;
CREATE TRIGGER set_updated_at_supplier_ratings
  BEFORE UPDATE ON public.supplier_public_ratings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_product_ratings ON public.product_public_ratings;
CREATE TRIGGER set_updated_at_product_ratings
  BEFORE UPDATE ON public.product_public_ratings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_tool_ratings ON public.tool_public_ratings;
CREATE TRIGGER set_updated_at_tool_ratings
  BEFORE UPDATE ON public.tool_public_ratings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 3. AVG_PUBLIC_RATING — recalcul automatique sur chaque changement de note
-- =============================================================================

-- Fournisseurs
CREATE OR REPLACE FUNCTION public.update_supplier_avg_rating()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_id uuid;
BEGIN
  target_id := COALESCE(NEW.supplier_id, OLD.supplier_id);
  UPDATE public.suppliers
  SET avg_public_rating = (
    SELECT AVG(rating)::float
    FROM public.supplier_public_ratings
    WHERE supplier_id = target_id
  )
  WHERE id = target_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_supplier_rating_change ON public.supplier_public_ratings;
CREATE TRIGGER on_supplier_rating_change
  AFTER INSERT OR UPDATE OR DELETE ON public.supplier_public_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_supplier_avg_rating();

-- Produits
CREATE OR REPLACE FUNCTION public.update_product_avg_rating()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_id uuid;
BEGIN
  target_id := COALESCE(NEW.product_id, OLD.product_id);
  UPDATE public.products
  SET avg_public_rating = (
    SELECT AVG(rating)::float
    FROM public.product_public_ratings
    WHERE product_id = target_id
  )
  WHERE id = target_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_product_rating_change ON public.product_public_ratings;
CREATE TRIGGER on_product_rating_change
  AFTER INSERT OR UPDATE OR DELETE ON public.product_public_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_product_avg_rating();

-- Outils
CREATE OR REPLACE FUNCTION public.update_tool_avg_rating()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_id uuid;
BEGIN
  target_id := COALESCE(NEW.tool_id, OLD.tool_id);
  UPDATE public.tools
  SET avg_public_rating = (
    SELECT AVG(rating)::float
    FROM public.tool_public_ratings
    WHERE tool_id = target_id
  )
  WHERE id = target_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_tool_rating_change ON public.tool_public_ratings;
CREATE TRIGGER on_tool_rating_change
  AFTER INSERT OR UPDATE OR DELETE ON public.tool_public_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_tool_avg_rating();
