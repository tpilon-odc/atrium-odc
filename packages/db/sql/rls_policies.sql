-- =============================================================================
-- RLS POLICIES — CGP Platform
-- À appliquer après `prisma migrate dev` via Supabase SQL editor
-- ou : psql $DATABASE_URL -f packages/db/sql/rls_policies.sql
--
-- Note : les specs utilisent `cabinet_id = auth.uid()` comme simplification.
-- L'implémentation correcte passe par cabinet_members (un user peut être
-- membre de plusieurs cabinets). Le cabinet_id actif est injecté par le
-- middleware API dans le contexte de session Postgres via SET LOCAL.
-- =============================================================================

-- Helper : les cabinets dont l'utilisateur connecté est membre actif
-- SECURITY DEFINER obligatoire : évite la récursion infinie
-- cabinet_members a lui-même une policy qui appelle auth.cabinet_ids()
-- Sans SECURITY DEFINER → stack depth limit exceeded
CREATE OR REPLACE FUNCTION auth.cabinet_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT cabinet_id
    FROM public.cabinet_members
    WHERE user_id = auth.uid()
      AND deleted_at IS NULL
  )
$$;

-- =============================================================================
-- AUTH & CABINETS
-- =============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_own"   ON public.users FOR SELECT USING (id = auth.uid());
CREATE POLICY "users_update_own"   ON public.users FOR UPDATE USING (id = auth.uid());
-- Insertion gérée par le trigger handle_new_user (pas par l'utilisateur)
CREATE POLICY "users_admin"        ON public.users USING (auth.jwt() ->> 'global_role' = 'platform_admin');

ALTER TABLE public.cabinets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cabinets_select"  ON public.cabinets FOR SELECT USING (id = ANY(auth.cabinet_ids()));
CREATE POLICY "cabinets_update"  ON public.cabinets FOR UPDATE USING (id = ANY(auth.cabinet_ids()));
CREATE POLICY "cabinets_insert"  ON public.cabinets FOR INSERT WITH CHECK (true); -- owner créé en même temps
CREATE POLICY "cabinets_admin"   ON public.cabinets USING (auth.jwt() ->> 'global_role' = 'platform_admin');

ALTER TABLE public.cabinet_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cabinet_members_select" ON public.cabinet_members FOR SELECT USING (cabinet_id = ANY(auth.cabinet_ids()));
CREATE POLICY "cabinet_members_insert" ON public.cabinet_members FOR INSERT WITH CHECK (cabinet_id = ANY(auth.cabinet_ids()));
CREATE POLICY "cabinet_members_update" ON public.cabinet_members FOR UPDATE USING (cabinet_id = ANY(auth.cabinet_ids()));
CREATE POLICY "cabinet_members_admin"  ON public.cabinet_members USING (auth.jwt() ->> 'global_role' = 'platform_admin');

-- =============================================================================
-- CONFORMITÉ — Tables admin (lecture ouverte, écriture platform_admin only)
-- =============================================================================

ALTER TABLE public.compliance_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compliance_phases_select" ON public.compliance_phases FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "compliance_phases_write"  ON public.compliance_phases FOR ALL USING (auth.jwt() ->> 'global_role' = 'platform_admin');

ALTER TABLE public.compliance_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compliance_items_select" ON public.compliance_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "compliance_items_write"  ON public.compliance_items FOR ALL USING (auth.jwt() ->> 'global_role' = 'platform_admin');

ALTER TABLE public.compliance_conditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compliance_conditions_select" ON public.compliance_conditions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "compliance_conditions_write"  ON public.compliance_conditions FOR ALL USING (auth.jwt() ->> 'global_role' = 'platform_admin');

-- Tables cabinet conformité (RLS strict)
ALTER TABLE public.cabinet_compliance_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compliance_answers_select" ON public.cabinet_compliance_answers FOR SELECT USING (cabinet_id = ANY(auth.cabinet_ids()));
CREATE POLICY "compliance_answers_insert" ON public.cabinet_compliance_answers FOR INSERT WITH CHECK (cabinet_id = ANY(auth.cabinet_ids()));
CREATE POLICY "compliance_answers_update" ON public.cabinet_compliance_answers FOR UPDATE USING (cabinet_id = ANY(auth.cabinet_ids()));
CREATE POLICY "compliance_answers_admin"  ON public.cabinet_compliance_answers USING (auth.jwt() ->> 'global_role' = 'platform_admin');

ALTER TABLE public.compliance_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compliance_notifs_select" ON public.compliance_notifications FOR SELECT USING (cabinet_id = ANY(auth.cabinet_ids()));
CREATE POLICY "compliance_notifs_admin"  ON public.compliance_notifications USING (auth.jwt() ->> 'global_role' = 'platform_admin');

-- =============================================================================
-- BASE COMMUNAUTAIRE — Fournisseurs (lecture ouverte, écriture authentifiée)
-- =============================================================================

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_select"  ON public.suppliers FOR SELECT USING (auth.role() = 'authenticated' AND deleted_at IS NULL);
CREATE POLICY "suppliers_insert"  ON public.suppliers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "suppliers_update"  ON public.suppliers FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "suppliers_admin"   ON public.suppliers USING (auth.jwt() ->> 'global_role' = 'platform_admin');

ALTER TABLE public.supplier_edits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_edits_select" ON public.supplier_edits FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "supplier_edits_insert" ON public.supplier_edits FOR INSERT WITH CHECK (cabinet_id = ANY(auth.cabinet_ids()));

ALTER TABLE public.cabinet_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cabinet_suppliers_select" ON public.cabinet_suppliers FOR SELECT USING (cabinet_id = ANY(auth.cabinet_ids()));
CREATE POLICY "cabinet_suppliers_insert" ON public.cabinet_suppliers FOR INSERT WITH CHECK (cabinet_id = ANY(auth.cabinet_ids()));
CREATE POLICY "cabinet_suppliers_update" ON public.cabinet_suppliers FOR UPDATE USING (cabinet_id = ANY(auth.cabinet_ids()));

ALTER TABLE public.supplier_public_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_ratings_select" ON public.supplier_public_ratings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "supplier_ratings_write"  ON public.supplier_public_ratings FOR ALL USING (cabinet_id = ANY(auth.cabinet_ids()));

-- =============================================================================
-- BASE COMMUNAUTAIRE — Produits
-- =============================================================================

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_select"  ON public.products FOR SELECT USING (auth.role() = 'authenticated' AND deleted_at IS NULL);
CREATE POLICY "products_insert"  ON public.products FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "products_update"  ON public.products FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "products_admin"   ON public.products USING (auth.jwt() ->> 'global_role' = 'platform_admin');

ALTER TABLE public.product_edits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_edits_select" ON public.product_edits FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "product_edits_insert" ON public.product_edits FOR INSERT WITH CHECK (cabinet_id = ANY(auth.cabinet_ids()));

ALTER TABLE public.product_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_suppliers_select" ON public.product_suppliers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "product_suppliers_write"  ON public.product_suppliers FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE public.cabinet_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cabinet_products_select" ON public.cabinet_products FOR SELECT USING (cabinet_id = ANY(auth.cabinet_ids()));
CREATE POLICY "cabinet_products_insert" ON public.cabinet_products FOR INSERT WITH CHECK (cabinet_id = ANY(auth.cabinet_ids()));
CREATE POLICY "cabinet_products_update" ON public.cabinet_products FOR UPDATE USING (cabinet_id = ANY(auth.cabinet_ids()));

ALTER TABLE public.product_public_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_ratings_select" ON public.product_public_ratings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "product_ratings_write"  ON public.product_public_ratings FOR ALL USING (cabinet_id = ANY(auth.cabinet_ids()));

-- =============================================================================
-- BASE COMMUNAUTAIRE — Outils
-- =============================================================================

ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tools_select"  ON public.tools FOR SELECT USING (auth.role() = 'authenticated' AND deleted_at IS NULL);
CREATE POLICY "tools_insert"  ON public.tools FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "tools_update"  ON public.tools FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "tools_admin"   ON public.tools USING (auth.jwt() ->> 'global_role' = 'platform_admin');

ALTER TABLE public.tool_edits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tool_edits_select" ON public.tool_edits FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "tool_edits_insert" ON public.tool_edits FOR INSERT WITH CHECK (cabinet_id = ANY(auth.cabinet_ids()));

ALTER TABLE public.cabinet_tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cabinet_tools_select" ON public.cabinet_tools FOR SELECT USING (cabinet_id = ANY(auth.cabinet_ids()));
CREATE POLICY "cabinet_tools_insert" ON public.cabinet_tools FOR INSERT WITH CHECK (cabinet_id = ANY(auth.cabinet_ids()));
CREATE POLICY "cabinet_tools_update" ON public.cabinet_tools FOR UPDATE USING (cabinet_id = ANY(auth.cabinet_ids()));

ALTER TABLE public.tool_public_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tool_ratings_select" ON public.tool_public_ratings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "tool_ratings_write"  ON public.tool_public_ratings FOR ALL USING (cabinet_id = ANY(auth.cabinet_ids()));

-- =============================================================================
-- CRM
-- =============================================================================

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_select" ON public.contacts FOR SELECT USING (cabinet_id = ANY(auth.cabinet_ids()) AND deleted_at IS NULL);
CREATE POLICY "contacts_insert" ON public.contacts FOR INSERT WITH CHECK (cabinet_id = ANY(auth.cabinet_ids()));
CREATE POLICY "contacts_update" ON public.contacts FOR UPDATE USING (cabinet_id = ANY(auth.cabinet_ids()));

-- Interactions : RLS via la table contacts (pas de cabinet_id direct)
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "interactions_select" ON public.interactions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.contacts
    WHERE contacts.id = interactions.contact_id
      AND contacts.cabinet_id = ANY(auth.cabinet_ids())
  )
);
CREATE POLICY "interactions_insert" ON public.interactions FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contacts
    WHERE contacts.id = interactions.contact_id
      AND contacts.cabinet_id = ANY(auth.cabinet_ids())
  )
);

-- =============================================================================
-- GED
-- =============================================================================

ALTER TABLE public.cabinet_storage_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "storage_config_select" ON public.cabinet_storage_config FOR SELECT USING (cabinet_id = ANY(auth.cabinet_ids()));
CREATE POLICY "storage_config_insert" ON public.cabinet_storage_config FOR INSERT WITH CHECK (cabinet_id = ANY(auth.cabinet_ids()));
CREATE POLICY "storage_config_update" ON public.cabinet_storage_config FOR UPDATE USING (cabinet_id = ANY(auth.cabinet_ids()));

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_select" ON public.documents FOR SELECT USING (cabinet_id = ANY(auth.cabinet_ids()) AND deleted_at IS NULL);
CREATE POLICY "documents_insert" ON public.documents FOR INSERT WITH CHECK (cabinet_id = ANY(auth.cabinet_ids()));
CREATE POLICY "documents_update" ON public.documents FOR UPDATE USING (cabinet_id = ANY(auth.cabinet_ids()));

-- DocumentLinks : RLS via documents
ALTER TABLE public.document_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "document_links_select" ON public.document_links FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.documents
    WHERE documents.id = document_links.document_id
      AND documents.cabinet_id = ANY(auth.cabinet_ids())
  )
);
CREATE POLICY "document_links_insert" ON public.document_links FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.documents
    WHERE documents.id = document_links.document_id
      AND documents.cabinet_id = ANY(auth.cabinet_ids())
  )
);

-- =============================================================================
-- FORMATIONS
-- =============================================================================

ALTER TABLE public.training_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training_catalog_select" ON public.training_catalog FOR SELECT USING (auth.role() = 'authenticated' AND deleted_at IS NULL);
CREATE POLICY "training_catalog_insert" ON public.training_catalog FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "training_catalog_update" ON public.training_catalog FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "training_catalog_admin"  ON public.training_catalog USING (auth.jwt() ->> 'global_role' = 'platform_admin');

ALTER TABLE public.collaborator_trainings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collab_trainings_select" ON public.collaborator_trainings FOR SELECT USING (cabinet_id = ANY(auth.cabinet_ids()) AND deleted_at IS NULL);
CREATE POLICY "collab_trainings_insert" ON public.collaborator_trainings FOR INSERT WITH CHECK (cabinet_id = ANY(auth.cabinet_ids()));
CREATE POLICY "collab_trainings_update" ON public.collaborator_trainings FOR UPDATE USING (cabinet_id = ANY(auth.cabinet_ids()));

-- =============================================================================
-- PARTAGE INTER-UTILISATEURS
-- =============================================================================

ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;
-- Un cabinet voit les partages qu'il a accordés
CREATE POLICY "shares_select_granter" ON public.shares FOR SELECT USING (cabinet_id = ANY(auth.cabinet_ids()));
-- Un utilisateur voit les partages qui lui sont destinés
CREATE POLICY "shares_select_recipient" ON public.shares FOR SELECT USING (granted_to = auth.uid());
CREATE POLICY "shares_insert" ON public.shares FOR INSERT WITH CHECK (cabinet_id = ANY(auth.cabinet_ids()));
CREATE POLICY "shares_update" ON public.shares FOR UPDATE USING (cabinet_id = ANY(auth.cabinet_ids()));
CREATE POLICY "shares_admin"  ON public.shares USING (auth.jwt() ->> 'global_role' = 'platform_admin');
