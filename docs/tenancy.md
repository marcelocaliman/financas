# Multi-tenancy & isolamento (RLS)

Como o app garante que **um household nunca vê nem toca os dados de outro**.

## Invariantes

1. **Toda tabela de dados de usuário tem `household_id`** e uma policy RLS
   `household_id = current_household_id()` (using + with check). `current_household_id()`
   = `select household_id from users where id = auth.uid()` (SECURITY DEFINER, STABLE).
2. **`account_id` pertence ao mesmo household da linha.** Garantido no banco pelo
   trigger `tg_assert_account_household` em `transactions` e `investments` — vale
   inclusive para escritas via service-role (appliers), não só RLS.
3. **RPCs admin exigem platform-admin no banco.** As `admin_*` têm guard
   `if not is_platform_admin() then raise` e são chamadas com o client
   autenticado (não service-role). Guard em TS (`requirePlatformAdmin`) é a 1ª
   barreira; o do banco é a definitiva.
4. **Service-role é exceção controlada.** Só crons e operações de plataforma usam
   `createAdminClient()` (bypassa RLS). Cada uso valida o escopo (household/user)
   antes de escrever; o trigff de account↔household protege mesmo aí.
5. **Convites são imprevisíveis.** Código de household = 16 bytes (128 bits).

## Prova de isolamento (testes)

`scripts/sql-tests/rls-isolation.sql` roda contra produção dentro de
`BEGIN…ROLLBACK`, trocando para o role `authenticated` + claims JWT (assim a RLS
de fato se aplica — superuser a bypassaria). As tentativas que **devem falhar**:

- **A** — leitura cross-tenant (userA não vê conta de B).
- **B** — escrita cross-tenant (userA não insere conta em household alheio).
- **C** — RPC admin chamada por não-admin é bloqueada.
- **D** — RPC admin funciona para admin (controle positivo).
- **E** — transação com `account_id` de outro household é barrada pelo trigger.

Rodar:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql-tests/rls-isolation.sql
# Espera-se: "✅ TODOS OS TESTES DE ISOLAMENTO PASSARAM"
```

Os caminhos de dinheiro têm suíte análoga em `scripts/sql-tests/money-paths.sql`.

## Ao adicionar uma tabela nova

1. Inclua `household_id uuid not null references households(id) on delete cascade`.
2. `enable row level security` + policy `household_id = current_household_id()`
   (using **e** with check).
3. Se tiver `account_id`, considere estender o trigger de invariante.
4. Adicione um caso no `rls-isolation.sql` cobrindo o vazamento.
