# LGPD — privacidade e direitos do titular

Como o app cumpre a Lei 13.709/2018. Resumo pra auditoria + base pro texto legal.

## Direitos do titular (art. 18)

- **Acesso / portabilidade (V):** exportação COMPLETA dos dados em JSON, dirigida
  por manifesto (`services/lgpd/data-manifest.ts`) — **todas** as 46 tabelas de
  dados pessoais (financeiro, IR, bens, dívidas, consentimentos). Self-service em
  Configurações → Privacidade. Tripwire SQL garante que tabela nova não escapa.
- **Eliminação (VI):** exclusão de conta **verificável e automágica**:
  - Reauth por senha obrigatória.
  - Soft-deactivate imediato (app entra em modo bloqueado) + período de
    arrependimento de `LGPD_DELETION_GRACE_DAYS` dias (cancelável).
  - Cron executa `delete_account_complete` após o grace — cascade nas 43 tabelas
    + `auth.users`, sem deixar órfão (provado por teste).
  - **Prova de eliminação** anonimizada em `deletion_proofs` (só ids/contagens/
    timestamp — sem PII).
- **Revogação de consentimento (IX):** gate de consentimento REAL (modal
  bloqueante + `assertConsent()` server-side). Leitura/export seguem liberados.

## Consentimento

- Versões em `TERMS_VERSION` / `PRIVACY_VERSION`. Bump de versão re-exibe o gate.
- Tipos: `terms_of_service`, `privacy_policy`, `data_processing`,
  `marketing_emails`, `analytics_cookies` (tabela `user_consents`, com IP/timestamp).
- O app **não envia e-mail promocional** — todos os e-mails são transacionais e
  controlados por `notification_preferences` (o titular liga/desliga cada tipo).

## Retenção (decisão D25)

| Dado | Retenção |
|------|----------|
| Prova de eliminação (`deletion_proofs`) | 5 anos |
| Logs de auditoria (admin/contador) | 5 anos |
| Logs de e-mail | 12 meses |
| Dados pessoais do titular | até a exclusão da conta (depois, só a prova anonimizada) |

> Validar os prazos com assessoria jurídica antes do lançamento público.

## Encarregado (DPO)

Definir o Encarregado de Dados e o canal de contato em `LGPD_DPO_EMAIL` (exibido
em /privacidade). Obrigatório pra SaaS público (art. 41).

## Acesso do contador

O contador tem acesso por ano concedido pelo titular (`accountant_household_access.years_allowed`),
auditado em `accountant_audit_log`. Os dados que ele cria entram no export do
titular (transparência, art. 18).

### Gap conhecido + plano seguro de correção

Hoje as policies "accountant read" chamam `is_accountant_with_access(household_id)`
SEM o ano → um contador com `years_allowed = {2024}` consegue ler dados de
QUALQUER ano do household (2023, 2025, …). É um vazamento real frente à concessão.

**Plano seguro (não aplicado ainda — exige validar o fluxo do contador + Bens):**
1. Helper `accountant_max_year(p_household_id)` = `max(years_allowed)` da concessão.
2. Nas 19 policies transacionais, trocar o `using` por
   `is_accountant_with_access(household_id) AND <ano_da_linha> <= accountant_max_year(household_id)`.
   - `<ano_da_linha>`: `extract(year from date)` (transactions), coluna `year`
     (ir_other_incomes, carne_leao_mensal, ir_*), etc. — específico por tabela.
3. **Por que `<= max` e não `= year`:** a montagem de Bens do ano N usa saldos de
   anos anteriores ("situação anterior"). `<= max` permite anos anteriores (Bens
   funciona) e BLOQUEIA anos FUTUROS (o vazamento real, sem risco pra Bens).
4. Validar com fixture de contador + dados multi-ano que: (a) lê o ano concedido
   e anteriores, (b) NÃO lê anos posteriores, (c) o relatório de Bens continua
   correto. Só então aplicar.

Aplicar isso sem (4) pode corromper a visão de IR do contador — por isso fica
documentado como pendência consciente, não improvisado.

## Pendências conhecidas (pra lançamento público)

- Nomear DPO + revisão por advogado dos textos de Termos/Privacidade.
- Estreitar RLS do contador por ano (com cuidado, ver acima).
- Geração assíncrona do export via Storage se households ficarem muito grandes
  (hoje é inline — suficiente pra o volume atual).
