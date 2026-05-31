# Ligar o billing (Stripe)

Todo o código de cobrança já está pronto e testável. **A única pendência é
criar a conta Stripe e preencher as env vars.** Sem isso, o app roda 100% e o
billing fica invisível (tudo liberado). Estimativa: ~30 min, sem tocar código.

## Passo a passo

1. **Criar conta** em https://dashboard.stripe.com e ativar o modo de produção
   (use o modo *test* primeiro pra validar).
2. **Produtos e preços.** Crie 2 produtos recorrentes mensais:
   - *Pro* → copie o `price_…` → `STRIPE_PRICE_PRO_MONTHLY`.
   - *Família* → copie o `price_…` → `STRIPE_PRICE_FAMILY_MONTHLY`.
   - (Opcional) *Lifetime* como produto avulso → `STRIPE_PRICE_LIFETIME`
     (hoje o lifetime é concedido pelo admin, não vendido na página).
   Os preços/limites de exibição vivem em `lib/billing/plans.ts` — ajuste lá se
   quiser outros valores.
3. **Chave secreta.** Developers → API keys → `Secret key` → `STRIPE_SECRET_KEY`.
4. **Webhook.** Developers → Webhooks → *Add endpoint*:
   - URL: `https://SEU_DOMINIO/api/billing/webhook`
   - Eventos: `customer.subscription.created`, `customer.subscription.updated`,
     `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
   - Copie o *Signing secret* → `STRIPE_WEBHOOK_SECRET`.
5. **Customer Portal.** Settings → Billing → Customer portal: habilite trocar de
   plano, cancelar e atualizar pagamento (e a política de proração que preferir).
6. **Env vars na Vercel** (e no `.env.local` pra testar):
   ```
   STRIPE_SECRET_KEY=sk_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRICE_PRO_MONTHLY=price_...
   STRIPE_PRICE_FAMILY_MONTHLY=price_...
   STRIPE_PRICE_LIFETIME=price_...        # opcional
   NEXT_PUBLIC_STRIPE_BILLING_ENABLED=true
   ```
7. **Agendar o dunning** em `vercel.json` (cron diário):
   `{ "path": "/api/cron/billing-dunning", "schedule": "0 12 * * *" }`.

Pronto. A página `/configuracoes/billing` passa a oferecer os planos, o checkout,
o portal e o estado da assinatura.

## Validar em test mode (antes da produção)

1. Use `sk_test_…` + price IDs de teste + `NEXT_PUBLIC_STRIPE_BILLING_ENABLED=true`.
2. `stripe login` e `stripe listen --forward-to localhost:3000/api/billing/webhook`
   (copie o `whsec_…` que o `listen` mostra pra `STRIPE_WEBHOOK_SECRET`).
3. Assine pelo app com um cartão de teste (`4242 4242 4242 4242`).
4. Confira no banco: `households.subscription_tier`/`status` atualizados pelo
   webhook (a fonte da verdade). Cancele pelo portal e veja voltar pra `free`.
5. Simule inadimplência: `stripe trigger invoice.payment_failed` → status vira
   `past_due`; rode `/api/cron/billing-dunning` algumas vezes pra ver a suspensão.

## Como funciona (resumo de arquitetura)

- **Fonte da verdade = webhook.** Só `app/api/billing/webhook` grava
  `subscription_*`. Checkout/portal só iniciam fluxos.
- **Idempotência** via `stripe_webhook_events` (o mesmo `event.id` nunca aplica 2x).
- **Entitlements** centralizados em `services/entitlements.ts` (único lugar que
  decide acesso). Billing desligado = tudo liberado.
- **Gating de escrita** em assinatura suspensa via `assertWritable()` (leitura e
  export sempre permitidos — direito LGPD).
- **Override manual** (`subscription_manual_override`) protege concessões do
  admin (lifetime/comp) do webhook e do dunning.
