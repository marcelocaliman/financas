# Capacitor + Play Store / App Store — checklist

> Plano pra empacotar o app (Vite/React PWA, E2EE, local-first) como app nativo via **Capacitor**
> e publicar na **Google Play** (e depois App Store). A parte VISUAL/responsiva já está pronta —
> aqui ficam os ajustes de **shell nativo** e as **regras de política** das lojas.
>
> Decisão do dono (2026): **pagamento só na WEB**. No app nativo, a assinatura Pro **não é comprável**
> — mostra-se uma tela informando que a assinatura é feita no site (evita a obrigatoriedade de
> Google Play Billing / Apple IAP para compra digital dentro do app).

## Já feito (prep, sem depender do Capacitor)
- `src/lib/native.ts` — `isNativeApp()` / `nativePlatform()` / `openExternal()`. Hoje na web = false;
  quando o Capacitor entrar, passa a valer no app. Teste na web com `?native=1` ou
  `localStorage nf-native=1`.
- **Pagamento só-web:** `UpgradeDialog` ([src/components/pro/upgrade-dialog.tsx](../src/components/pro/upgrade-dialog.tsx))
  troca todo o fluxo Stripe por um painel "assine no site" quando `isNativeApp()`. Cobre TODOS os
  pontos que abrem o paywall (upsell, nav-card, billing).
- **Safe areas:** viewport já tem `viewport-fit=cover` (index.html + app.html). Bottom-nav já usa
  `env(safe-area-inset-bottom)`; a barra superior (MobileBar) agora usa `env(safe-area-inset-top)`.
- **Install banner** some no app nativo (`isNativeApp()`).
- Hide-on-scroll da topbar + todo o passe de densidade/pickers-em-bottom-sheet já são mobile-native.

## Shell nativo — a fazer QUANDO adicionar o Capacitor
- Instalar Capacitor + plugins: `@capacitor/status-bar`, `@capacitor/splash-screen`,
  `@capacitor/keyboard`, `@capacitor/app` (back button), `@capacitor/browser` (abrir web externa).
- **Botão VOLTAR do Android** (`App.addListener('backButton', …)`): fechar na ordem o overlay do topo
  antes de sair do app. Ordem sugerida (fechar o 1º que estiver aberto):
  1. bottom sheet de picker aberto (DataGrid) — hoje fecham no Escape/backdrop; expor um "close".
  2. `useProStore.paywallOpen` → `closePaywall()`.
  3. `useUI.supportOpen` → `setSupportOpen(false)`.
  4. `useUI.configOpen` → `setConfigOpen(false)`.
  5. `useAdminUI.adminOpen` → fechar painel admin.
  6. seção (accordion) aberta / senão, `App.exitApp()` (ou minimizar).
- **StatusBar:** estilo/cor conforme tema (dark/light) via `@capacitor/status-bar`.
- **Splash screen:** logo + fundo `#0A0B0D`; esconder no boot.
- **Teclado:** `resize: 'native'`/`body`; garantir que os inputs das tabelas não fiquem atrás do teclado.
- **Service worker:** desligar/ignorar o SW da PWA dentro do app nativo (o Capacitor serve local) —
  hoje via vite-plugin-pwa; checar `injectRegister`/registro condicional em `isNativeApp()`.
- **openExternal:** trocar `window.open` por `Browser.open` do Capacitor no app.
- **Deep links / routing:** o app roda em `/app` (app.html) — configurar `server`/`webDir` e o esquema.

## Regras de política das lojas — obrigatórias
- **💳 Pagamento:** RESOLVIDO pela decisão "só web" — nada de compra digital dentro do app. Manter o
  `WebOnlyPanel`. ⚠️ Cuidado: linkar direto pra pagamento web pode ser sensível na política; se
  reprovar, deixar o painel **só informativo** (sem botão que leve à compra). App = visualização.
- **🗑️ Exclusão de conta (Google Play, obrigatório):** o usuário precisa conseguir **apagar a conta e
  os dados dentro do app** + uma **URL pública** de exclusão. Hoje existe exclusão via admin (LGPD);
  **FALTA** o fluxo iniciado pelo próprio usuário (RPC self-delete + botão em Config → Conta) e a
  página web de exclusão. **TODO antes de publicar.**
- **📋 Data Safety (Play) / App Privacy (Apple):** formulário declarando coleta/compartilhamento. A
  favor: E2EE, sem ads, sem rastreio; só metadados anônimos (`app_events`) + e-mail de auth. Declarar
  fielmente. Política de privacidade já publicada (páginas legais).
- **Target API level** recente (a Play atualiza todo ano) — o Capacitor cuida; manter atualizado.
- **Permissões mínimas** — o app é offline/local; não pedir nada além do necessário.
- **Ficha da loja:** ícone, screenshots, descrição deixando claro que é um app de finanças PESSOAIS
  (não instituição financeira). App de PF não cai nas políticas pesadas de fintech (empréstimo/pagamentos).

## Ordem sugerida
1. (feito) prep web-side. 2. Self-delete de conta + URL pública. 3. Adicionar Capacitor + plugins +
back button + status/splash/keyboard. 4. Data Safety + ficha. 5. Testar em device. 6. Publicar.
