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

O contador tem acesso por ano concedido pelo titular (`accountant_household_access`),
auditado em `accountant_audit_log`. Os dados que ele cria entram no export do
titular (transparência, art. 18). Estreitar o RLS do contador por ano nas tabelas
transacionais é um refinamento pendente — exige validar que não quebra a montagem
de Bens (que precisa de saldos de anos anteriores).

## Pendências conhecidas (pra lançamento público)

- Nomear DPO + revisão por advogado dos textos de Termos/Privacidade.
- Estreitar RLS do contador por ano (com cuidado, ver acima).
- Geração assíncrona do export via Storage se households ficarem muito grandes
  (hoje é inline — suficiente pra o volume atual).
