-- ============================================================
-- Politiques RLS — Multi-tenant isolation par cabinet
-- ============================================================
-- Prisma (rôle postgres) utilise BYPASSRLS — ces politiques
-- s'appliquent aux appels directs Supabase JS (anon/authenticated).
-- ============================================================

-- Helper : retourne les cabinet_ids auxquels appartient l'utilisateur courant
-- Note: dans public (pas auth) car le rôle postgres n'a pas accès au schéma auth en local
CREATE OR REPLACE FUNCTION public.cabinet_ids_for_user()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT cabinet_id FROM public.cabinet_members WHERE user_id = auth.uid()
$$;

-- ── CABINETS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.cabinets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cabinets_select_member" ON public.cabinets
  FOR SELECT USING (id IN (SELECT public.cabinet_ids_for_user()));

CREATE POLICY "cabinets_select_admin" ON public.cabinets
  FOR SELECT USING ((auth.jwt() ->> 'global_role') IN ('platform_admin', 'regulator', 'chamber'));

-- ── CABINET_MEMBERS ───────────────────────────────────────────────────────────
ALTER TABLE public.cabinet_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cabinet_members_select" ON public.cabinet_members
  FOR SELECT USING (cabinet_id IN (SELECT public.cabinet_ids_for_user()));

-- ── CONTACTS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_cabinet_only" ON public.contacts
  FOR ALL USING (cabinet_id IN (SELECT public.cabinet_ids_for_user()));

-- ── DOCUMENTS ────────────────────────────────────────────────────────────────
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_cabinet_only" ON public.documents
  FOR ALL USING (cabinet_id IN (SELECT public.cabinet_ids_for_user()));

-- ── FOLDERS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "folders_cabinet_only" ON public.folders
  FOR ALL USING (cabinet_id IN (SELECT public.cabinet_ids_for_user()));

-- ── TAGS (cabinet = private | cabinet_id NULL = système) ─────────────────────
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- Tags système (platform_admin) : lecture pour tous les membres
CREATE POLICY "tags_system_read" ON public.tags
  FOR SELECT USING (cabinet_id IS NULL);

-- Tags cabinet : CRUD réservé au cabinet propriétaire
CREATE POLICY "tags_cabinet_all" ON public.tags
  FOR ALL USING (cabinet_id IN (SELECT public.cabinet_ids_for_user()));

-- ── DOCUMENT_TAGS ────────────────────────────────────────────────────────────
ALTER TABLE public.document_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_tags_via_document" ON public.document_tags
  FOR ALL USING (
    document_id IN (
      SELECT id FROM public.documents
      WHERE cabinet_id IN (SELECT public.cabinet_ids_for_user())
    )
  );

-- ── DOCUMENT_LINKS ───────────────────────────────────────────────────────────
ALTER TABLE public.document_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_links_via_document" ON public.document_links
  FOR ALL USING (
    document_id IN (
      SELECT id FROM public.documents
      WHERE cabinet_id IN (SELECT public.cabinet_ids_for_user())
    )
  );

-- ── CABINET_COMPLIANCE_ANSWERS ───────────────────────────────────────────────
ALTER TABLE public.cabinet_compliance_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_answers_cabinet_only" ON public.cabinet_compliance_answers
  FOR ALL USING (cabinet_id IN (SELECT public.cabinet_ids_for_user()));

-- ── COMPLIANCE_NOTIFICATIONS ─────────────────────────────────────────────────
ALTER TABLE public.compliance_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_notifications_cabinet_only" ON public.compliance_notifications
  FOR ALL USING (cabinet_id IN (SELECT public.cabinet_ids_for_user()));

-- ── CABINET_SUPPLIER (données privées cabinet) ────────────────────────────────
ALTER TABLE public.cabinet_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cabinet_suppliers_cabinet_only" ON public.cabinet_suppliers
  FOR ALL USING (cabinet_id IN (SELECT public.cabinet_ids_for_user()));

-- ── SUPPLIER_PUBLIC_RATINGS ───────────────────────────────────────────────────
-- Lecture publique (tous membres), écriture cabinet propriétaire
ALTER TABLE public.supplier_public_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_ratings_read_all" ON public.supplier_public_ratings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.cabinet_members WHERE user_id = auth.uid())
  );

CREATE POLICY "supplier_ratings_write_own" ON public.supplier_public_ratings
  FOR ALL USING (cabinet_id IN (SELECT public.cabinet_ids_for_user()));

-- ── PRODUCT_PUBLIC_RATINGS ────────────────────────────────────────────────────
ALTER TABLE public.product_public_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_ratings_read_all" ON public.product_public_ratings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.cabinet_members WHERE user_id = auth.uid())
  );

CREATE POLICY "product_ratings_write_own" ON public.product_public_ratings
  FOR ALL USING (cabinet_id IN (SELECT public.cabinet_ids_for_user()));

-- ── TOOL_PUBLIC_RATINGS ───────────────────────────────────────────────────────
ALTER TABLE public.tool_public_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tool_ratings_read_all" ON public.tool_public_ratings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.cabinet_members WHERE user_id = auth.uid())
  );

CREATE POLICY "tool_ratings_write_own" ON public.tool_public_ratings
  FOR ALL USING (cabinet_id IN (SELECT public.cabinet_ids_for_user()));

-- ── CABINET_PRODUCTS ──────────────────────────────────────────────────────────
ALTER TABLE public.cabinet_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cabinet_products_cabinet_only" ON public.cabinet_products
  FOR ALL USING (cabinet_id IN (SELECT public.cabinet_ids_for_user()));

-- ── CABINET_TOOLS ─────────────────────────────────────────────────────────────
ALTER TABLE public.cabinet_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cabinet_tools_cabinet_only" ON public.cabinet_tools
  FOR ALL USING (cabinet_id IN (SELECT public.cabinet_ids_for_user()));

-- ── EVENTS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_cabinet_only" ON public.events
  FOR ALL USING (cabinet_id IN (SELECT public.cabinet_ids_for_user()));

-- ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_user_only" ON public.notifications
  FOR ALL USING (
    user_id = auth.uid()
    AND cabinet_id IN (SELECT public.cabinet_ids_for_user())
  );

-- ── SHARES ────────────────────────────────────────────────────────────────────
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

-- Lecture : émetteur ou destinataire
CREATE POLICY "shares_read" ON public.shares
  FOR SELECT USING (
    granted_by = auth.uid()
    OR granted_to = auth.uid()
  );

-- Écriture : cabinet propriétaire
CREATE POLICY "shares_write_cabinet" ON public.shares
  FOR INSERT WITH CHECK (cabinet_id IN (SELECT public.cabinet_ids_for_user()));

CREATE POLICY "shares_update_cabinet" ON public.shares
  FOR UPDATE USING (cabinet_id IN (SELECT public.cabinet_ids_for_user()));

-- ── EXPORT_JOBS ───────────────────────────────────────────────────────────────
ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "export_jobs_cabinet_only" ON public.export_jobs
  FOR ALL USING (cabinet_id IN (SELECT public.cabinet_ids_for_user()));

-- ── GDPR_REQUESTS ─────────────────────────────────────────────────────────────
ALTER TABLE public.gdpr_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gdpr_requests_own" ON public.gdpr_requests
  FOR ALL USING (
    requested_by = auth.uid()
    AND cabinet_id IN (SELECT public.cabinet_ids_for_user())
  );

-- ── CABINET_PCA ───────────────────────────────────────────────────────────────
ALTER TABLE public.cabinet_pca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cabinet_pcas_cabinet_only" ON public.cabinet_pca
  FOR ALL USING (cabinet_id IN (SELECT public.cabinet_ids_for_user()));

-- ── CLUSTERS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.clusters ENABLE ROW LEVEL SECURITY;

-- Clusters publics : visibles de tous les membres authentifiés
CREATE POLICY "clusters_read_public" ON public.clusters
  FOR SELECT USING (
    is_public = true
    AND EXISTS (SELECT 1 FROM public.cabinet_members WHERE user_id = auth.uid())
  );

-- Clusters privés : visibles des membres du cluster seulement
CREATE POLICY "clusters_read_member" ON public.clusters
  FOR SELECT USING (
    id IN (
      SELECT cluster_id FROM public.cluster_members
      WHERE cabinet_id IN (SELECT public.cabinet_ids_for_user())
    )
  );

-- ── CLUSTER_MEMBERS ───────────────────────────────────────────────────────────
ALTER TABLE public.cluster_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cluster_members_read" ON public.cluster_members
  FOR SELECT USING (
    cluster_id IN (
      SELECT cluster_id FROM public.cluster_members
      WHERE cabinet_id IN (SELECT public.cabinet_ids_for_user())
    )
  );

CREATE POLICY "cluster_members_write" ON public.cluster_members
  FOR ALL USING (cabinet_id IN (SELECT public.cabinet_ids_for_user()));

-- ── MESSAGES ──────────────────────────────────────────────────────────────────
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_read" ON public.messages
  FOR SELECT USING (
    channel_id IN (
      SELECT c.id FROM public.channels c
      JOIN public.cluster_members cm ON cm.cluster_id = c.cluster_id
      WHERE cm.cabinet_id IN (SELECT public.cabinet_ids_for_user())
    )
  );

CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT WITH CHECK (
    author_user_id = auth.uid()
    AND author_cabinet_id IN (SELECT public.cabinet_ids_for_user())
  );

CREATE POLICY "messages_update_own" ON public.messages
  FOR UPDATE USING (author_user_id = auth.uid());

CREATE POLICY "messages_delete_own" ON public.messages
  FOR DELETE USING (author_user_id = auth.uid());

-- ── SUPPLIER_USERS (portail fournisseur) ──────────────────────────────────────
ALTER TABLE public.supplier_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_users_own" ON public.supplier_users
  FOR ALL USING (user_id = auth.uid());

-- ── FOLDER_RULES ──────────────────────────────────────────────────────────────
ALTER TABLE public.folder_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "folder_rules_cabinet_only" ON public.folder_rules
  FOR ALL USING (cabinet_id IN (SELECT public.cabinet_ids_for_user()));

-- ── FOLDER_RULE_TAGS ──────────────────────────────────────────────────────────
ALTER TABLE public.folder_rule_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "folder_rule_tags_via_rule" ON public.folder_rule_tags
  FOR ALL USING (
    folder_rule_id IN (
      SELECT id FROM public.folder_rules
      WHERE cabinet_id IN (SELECT public.cabinet_ids_for_user())
    )
  );

-- ── SUPPLIERS & PRODUCTS & TOOLS (base communautaire partagée) ────────────────
-- Ces tables n'ont pas de cabinet_id → lecture pour tous les authentifiés,
-- écriture réservée à platform_admin (via API uniquement — la RLS bloque le direct).
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_read_authenticated" ON public.suppliers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.cabinet_members WHERE user_id = auth.uid())
  );

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_read_authenticated" ON public.products
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.cabinet_members WHERE user_id = auth.uid())
  );

ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tools_read_authenticated" ON public.tools
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.cabinet_members WHERE user_id = auth.uid())
  );

-- ── COMPLIANCE_ITEMS & PHASES (référentiel système) ───────────────────────────
ALTER TABLE public.compliance_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_phases_read_all" ON public.compliance_phases
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.cabinet_members WHERE user_id = auth.uid())
  );

ALTER TABLE public.compliance_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_items_read_all" ON public.compliance_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.cabinet_members WHERE user_id = auth.uid())
  );

-- ── TRAINING_CATEGORIES & CATALOG (référentiel) ───────────────────────────────
ALTER TABLE public.training_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_categories_read_all" ON public.training_categories
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.cabinet_members WHERE user_id = auth.uid())
  );

ALTER TABLE public.training_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_catalog_read_all" ON public.training_catalog
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.cabinet_members WHERE user_id = auth.uid())
  );

-- ── COLLABORATOR_TRAININGS ────────────────────────────────────────────────────
ALTER TABLE public.collaborator_trainings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collaborator_trainings_cabinet_only" ON public.collaborator_trainings
  FOR ALL USING (cabinet_id IN (SELECT public.cabinet_ids_for_user()));

-- ── CONSENT_RECORDS ───────────────────────────────────────────────────────────
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consent_records_own" ON public.consent_records
  FOR ALL USING (user_id = auth.uid());
