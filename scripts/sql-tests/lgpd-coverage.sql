-- ============================================================================
-- LGPD: tripwire de cobertura do export/delete. Se alguém adicionar uma tabela
-- com household_id e esquecer de incluir no manifesto (services/lgpd/
-- data-manifest.ts), a contagem muda e este teste falha — forçando a atualização.
-- Não precisa de rollback (só lê o catálogo).
-- ============================================================================
do $$
declare v_count int;
begin
  select count(*) into v_count
  from information_schema.tables t
  join information_schema.columns c
    on c.table_schema = t.table_schema and c.table_name = t.table_name
  where t.table_schema = 'public'
    and t.table_type = 'BASE TABLE'
    and c.column_name = 'household_id'
    -- deletion_proofs tem household_id mas NÃO é dado pessoal do titular: é a
    -- prova de eliminação (retenção legal, sobrevive ao delete). Excluída.
    and t.table_name <> 'deletion_proofs';

  assert v_count = 43,
    'Manifesto LGPD possivelmente desatualizado: ' || v_count ||
    ' tabelas com household_id (esperado 43). Atualize services/lgpd/data-manifest.ts ' ||
    'e este teste.';
  raise notice 'TESTE LGPD ok — % tabelas household-scoped cobertas pelo manifesto', v_count;
end $$;
