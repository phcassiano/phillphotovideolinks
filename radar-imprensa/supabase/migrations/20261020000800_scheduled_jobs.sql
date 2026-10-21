-- =============================================================================
-- Radar de Imprensa — agendamentos (Supabase Cron / pg_cron)
-- -----------------------------------------------------------------------------
-- Executado somente quando a extensão pg_cron está disponível (Supabase).
-- Tarefas puramente SQL ficam aqui. O processamento das verificações (que
-- consulta provedores externos) é feito pela Edge Function `verification-dispatch`;
-- veja docs/DEPLOY.md para agendá-la com segredos guardados no Vault.
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;

    perform cron.schedule('radar-agendar-verificacoes', '15 3 * * *',
      'select public.schedule_due_verifications()');
    perform cron.schedule('radar-marcar-desatualizados', '45 3 * * *',
      'select public.mark_outdated_profiles()');
    perform cron.schedule('radar-limpar-limites', '0 4 * * *',
      'select public.prune_rate_limit_events()');
  else
    raise notice 'pg_cron indisponível: agendamentos não criados (ambiente local/teste).';
  end if;
end;
$$;
