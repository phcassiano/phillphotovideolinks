-- =============================================================================
-- Radar de Imprensa — Row Level Security
-- -----------------------------------------------------------------------------
-- Princípios:
--  * RLS habilitado em TODAS as tabelas do schema public.
--  * Usuários comuns (assessores) NÃO leem diretamente jornalistas, vínculos,
--    contatos e evidências: o acesso é feito por RPCs com limite de uso
--    (search_journalists, get_journalist_profile, get_journalist_contacts...),
--    o que impede a coleta em massa via API.
--  * Administradores e o próprio titular (perfil reivindicado) leem diretamente.
--  * O papel anônimo não tem acesso a nenhuma tabela.
-- =============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations', 'profiles', 'locations', 'editorial_categories', 'topics', 'media_outlets',
    'journalists', 'journalist_identifiers', 'journalist_topics', 'source_evidence',
    'journalist_employments', 'journalist_employment_categories', 'journalist_contacts',
    'journalist_change_history', 'verification_jobs', 'change_proposals',
    'journalist_merge_suggestions', 'journalist_merges', 'favorites', 'mailing_lists',
    'mailing_list_members', 'journalist_interactions', 'profile_claims', 'privacy_requests',
    'audit_logs', 'rate_limit_events', 'contact_access_logs', 'app_settings',
    'import_batches', 'import_rows'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Organizações e perfis
-- -----------------------------------------------------------------------------
create policy organizations_select on public.organizations for select to authenticated
  using (id = app_private.current_org_id() or app_private.is_admin());
create policy organizations_write on public.organizations for all to authenticated
  using (app_private.is_super_admin()) with check (app_private.is_super_admin());

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or app_private.is_admin());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_super on public.profiles for update to authenticated
  using (app_private.is_super_admin()) with check (app_private.is_super_admin());

-- -----------------------------------------------------------------------------
-- Dados de referência: leitura para autenticados, escrita para administradores
-- -----------------------------------------------------------------------------
create policy locations_select on public.locations for select to authenticated using (true);
create policy locations_write on public.locations for all to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());

create policy editorial_categories_select on public.editorial_categories for select to authenticated using (true);
create policy editorial_categories_write on public.editorial_categories for all to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());

create policy topics_select on public.topics for select to authenticated using (true);
create policy topics_insert_owner on public.topics for insert to authenticated
  with check (app_private.current_user_role() in ('jornalista', 'admin', 'super_admin'));
create policy topics_write on public.topics for update to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());
create policy topics_delete on public.topics for delete to authenticated using (app_private.is_admin());

create policy media_outlets_select on public.media_outlets for select to authenticated using (true);
create policy media_outlets_write on public.media_outlets for all to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());

-- -----------------------------------------------------------------------------
-- Jornalistas e dados profissionais
-- -----------------------------------------------------------------------------
create policy journalists_select on public.journalists for select to authenticated
  using (app_private.is_admin() or claimed_by = auth.uid());
create policy journalists_insert on public.journalists for insert to authenticated
  with check (app_private.is_admin());
create policy journalists_update on public.journalists for update to authenticated
  using (app_private.is_admin() or claimed_by = auth.uid())
  with check (app_private.is_admin() or claimed_by = auth.uid());
create policy journalists_delete on public.journalists for delete to authenticated
  using (app_private.is_admin());

create policy journalist_identifiers_select on public.journalist_identifiers for select to authenticated
  using (app_private.is_admin() or app_private.owns_journalist(journalist_id));
create policy journalist_identifiers_write on public.journalist_identifiers for all to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());

create policy journalist_topics_select on public.journalist_topics for select to authenticated
  using (app_private.is_admin() or app_private.owns_journalist(journalist_id));
create policy journalist_topics_write on public.journalist_topics for all to authenticated
  using (app_private.is_admin() or app_private.owns_journalist(journalist_id))
  with check (
    app_private.is_admin()
    or (app_private.owns_journalist(journalist_id) and origin = 'titular')
  );

create policy source_evidence_select on public.source_evidence for select to authenticated
  using (app_private.is_admin() or app_private.owns_journalist(journalist_id));
create policy source_evidence_write on public.source_evidence for all to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());

create policy journalist_employments_select on public.journalist_employments for select to authenticated
  using (app_private.is_admin() or app_private.owns_journalist(journalist_id));
create policy journalist_employments_insert on public.journalist_employments for insert to authenticated
  with check (app_private.is_admin() or app_private.owns_journalist(journalist_id));
create policy journalist_employments_update on public.journalist_employments for update to authenticated
  using (app_private.is_admin() or app_private.owns_journalist(journalist_id))
  with check (app_private.is_admin() or app_private.owns_journalist(journalist_id));
-- Vínculos não são apagados por titulares: encerram-se (end_date) para preservar o histórico.
create policy journalist_employments_delete on public.journalist_employments for delete to authenticated
  using (app_private.is_admin());

create policy journalist_employment_categories_select on public.journalist_employment_categories for select to authenticated
  using (
    app_private.is_admin()
    or exists (select 1 from public.journalist_employments e
               where e.id = employment_id and app_private.owns_journalist(e.journalist_id))
  );
create policy journalist_employment_categories_write on public.journalist_employment_categories for all to authenticated
  using (
    app_private.is_admin()
    or exists (select 1 from public.journalist_employments e
               where e.id = employment_id and app_private.owns_journalist(e.journalist_id))
  )
  with check (
    app_private.is_admin()
    or exists (select 1 from public.journalist_employments e
               where e.id = employment_id and app_private.owns_journalist(e.journalist_id))
  );

create policy journalist_contacts_select on public.journalist_contacts for select to authenticated
  using (app_private.is_admin() or app_private.owns_journalist(journalist_id));
create policy journalist_contacts_insert on public.journalist_contacts for insert to authenticated
  with check (app_private.is_admin() or app_private.owns_journalist(journalist_id));
create policy journalist_contacts_update on public.journalist_contacts for update to authenticated
  using (app_private.is_admin() or app_private.owns_journalist(journalist_id))
  with check (app_private.is_admin() or app_private.owns_journalist(journalist_id));
create policy journalist_contacts_delete on public.journalist_contacts for delete to authenticated
  using (app_private.is_admin() or app_private.owns_journalist(journalist_id));

create policy journalist_change_history_select on public.journalist_change_history for select to authenticated
  using (app_private.is_admin() or app_private.owns_journalist(journalist_id));
-- Inserções somente por trigger (SECURITY DEFINER). Sem políticas de escrita.

-- -----------------------------------------------------------------------------
-- Verificações, propostas e identidade (administração)
-- -----------------------------------------------------------------------------
create policy verification_jobs_admin on public.verification_jobs for all to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());

create policy change_proposals_select on public.change_proposals for select to authenticated
  using (app_private.is_admin() or proposed_by = auth.uid());
-- Sugestões de usuários entram sempre como pendentes; aprovação só via RPC.
create policy change_proposals_insert_suggestion on public.change_proposals for insert to authenticated
  with check (
    proposed_by = auth.uid()
    and status = 'pendente'
    and requires_human_review
    and not is_demo
    and reviewed_by is null
    and (
      source = 'sugestao_usuario'
      or (source = 'titular' and app_private.owns_journalist(journalist_id))
    )
    and app_private.journalist_is_visible(journalist_id)
  );
create policy change_proposals_admin_write on public.change_proposals for all to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());

create policy merge_suggestions_admin on public.journalist_merge_suggestions for all to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());
create policy merges_admin_select on public.journalist_merges for select to authenticated
  using (app_private.is_admin());

-- -----------------------------------------------------------------------------
-- Recursos dos assessores
-- -----------------------------------------------------------------------------
create policy favorites_own on public.favorites for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and app_private.journalist_is_visible(journalist_id));

create policy mailing_lists_select on public.mailing_lists for select to authenticated
  using (app_private.can_access_mailing(id));
create policy mailing_lists_insert on public.mailing_lists for insert to authenticated
  with check (
    owner_id = auth.uid()
    and (organization_id is null or organization_id = app_private.current_org_id())
  );
create policy mailing_lists_update on public.mailing_lists for update to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and (organization_id is null or organization_id = app_private.current_org_id())
  );
create policy mailing_lists_delete on public.mailing_lists for delete to authenticated
  using (owner_id = auth.uid());

create policy mailing_list_members_select on public.mailing_list_members for select to authenticated
  using (app_private.can_access_mailing(mailing_list_id));
create policy mailing_list_members_insert on public.mailing_list_members for insert to authenticated
  with check (
    app_private.owns_mailing(mailing_list_id)
    and app_private.journalist_is_visible(journalist_id)
    and (added_by is null or added_by = auth.uid())
  );
create policy mailing_list_members_update on public.mailing_list_members for update to authenticated
  using (app_private.owns_mailing(mailing_list_id))
  with check (app_private.owns_mailing(mailing_list_id));
create policy mailing_list_members_delete on public.mailing_list_members for delete to authenticated
  using (app_private.owns_mailing(mailing_list_id));

create policy journalist_interactions_own on public.journalist_interactions for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and app_private.journalist_is_visible(journalist_id));

-- -----------------------------------------------------------------------------
-- Titulares
-- -----------------------------------------------------------------------------
create policy profile_claims_select on public.profile_claims for select to authenticated
  using (user_id = auth.uid() or app_private.is_admin());
-- Inserção via RPC submit_profile_claim (calcula sinais de verificação no servidor).

create policy privacy_requests_select on public.privacy_requests for select to authenticated
  using (requester_id = auth.uid() or app_private.is_admin());
-- Inserção via RPC submit_privacy_request; resolução via RPC resolve_privacy_request.

-- -----------------------------------------------------------------------------
-- Auditoria, limites e parâmetros
-- -----------------------------------------------------------------------------
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (app_private.is_super_admin());
-- rate_limit_events: sem políticas (acesso somente por funções SECURITY DEFINER).
create policy contact_access_logs_select on public.contact_access_logs for select to authenticated
  using (app_private.is_admin());

create policy app_settings_select on public.app_settings for select to authenticated using (true);
create policy app_settings_write on public.app_settings for all to authenticated
  using (app_private.is_super_admin()) with check (app_private.is_super_admin());

create policy import_batches_admin on public.import_batches for all to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());
create policy import_rows_admin on public.import_rows for all to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());

-- -----------------------------------------------------------------------------
-- Privilégios de funções
-- -----------------------------------------------------------------------------
grant usage on schema app_private to authenticated, service_role;
grant execute on all functions in schema app_private to authenticated, service_role;
revoke execute on all functions in schema app_private from anon, public;
