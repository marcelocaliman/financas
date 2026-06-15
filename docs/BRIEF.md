# Brief — Web App de Finanças Pessoais Multimoeda (cross-border)

> Documento de partida para construir o app numa conversa nova.
> **Como usar:** abra um chat novo (de preferência neste mesmo Projeto, pela continuidade de memória), cole ou anexe este arquivo + a planilha `Gestao_Patrimonial_Multimoeda_Template.xlsx`, e seguimos a partir daqui.

---

## 1. Visão geral
App web **gratuito e privado** de gestão de finanças pessoais **multimoeda**, voltado a quem administra dinheiro **entre países** — expatriados, quem está se mudando, famílias com renda/patrimônio em mais de uma moeda. Diferenciais: simples mas completo, funciona em qualquer país, e **os dados financeiros nunca saem do navegador do usuário** (privacidade total). Construído por quem está vivendo a mudança Brasil→Itália, com profundidade real de câmbio e estrutura tributária.

## 2. Público / nicho
- **Wedge inicial (foco):** expatriados e quem está se mudando de país; pessoas com contas/ativos em 2+ moedas.
- **Por quê:** é onde está a vantagem injusta (vivência própria do tema), a dor é real e a disposição a pagar é maior. Finanças pessoais é um mercado lotado, mas *multimoeda + cross-border + privacidade* é mal atendido.
- **Ampliação depois:** qualquer pessoa que queira um controle financeiro simples e privado.

## 3. Princípios de produto (inegociáveis)
- **Grátis para usar.**
- **Privado:** dado financeiro 100% client-side; nunca em servidor.
- **Multimoeda de verdade:** moeda de exibição + tabela de câmbio; cada item guarda sua própria moeda.
- **Simples, mas completo** (filosofia herdada da planilha).
- **Base via e-mail (opt-in), não via dado financeiro.**
- **Funciona em qualquer país / idioma.**
- **Portabilidade:** export/import dos dados — o usuário é dono.

## 4. Arquitetura (decisões já tomadas)
- **Client-side only** (SPA / PWA), sem backend obrigatório. Stack sugerida: React + Vite, hospedagem estática (Vercel / Netlify / GitHub Pages). PWA para instalar e usar offline.
- **Persistência local:** `localStorage` / `IndexedDB`. Sem conta para usar o app.
- **Câmbio:** API gratuita (candidatas a verificar tier atual: Frankfurter, exchangerate.host, open.er-api) com **cache** e **fallback de entrada manual** — o app nunca pode quebrar se a API falhar.
- **Export / import:** JSON (backup completo) e CSV (interoperabilidade).
- **Opt-in de e-mail:** serviço externo (ex.: Buttondown / ConvertKit / Mailchimp) — único ponto que guarda dado (e-mail, com consentimento; atenção a LGPD/GDPR).
- **i18n:** PT-BR, EN, IT no mínimo.

## 5. Funcionalidades

### MVP — núcleo (espelha a planilha atual)
- Moeda de exibição configurável + tabela de câmbio (automática + manual).
- **Patrimônio:** ativos, passivos, patrimônio líquido, composição.
- **Investimentos:** posições, retorno, alocação vs. alvo (rebalanceamento).
- **Orçamento mensal:** receitas/gastos por categoria, multimoeda, gráfico do mês.
- **Histórico:** evolução do patrimônio, variação, aportes.
- **Objetivos:** metas com barra de progresso, multimoeda.
- **Projeção:** juros compostos sobre patrimônio + aportes; nominal vs. valor em moeda de hoje; tabela ano a ano + gráfico.
- **Painel:** dashboard consolidando tudo.
- Export / import (backup).

### V1 — logo na sequência
- Projeção multi-cenário (otimista / base / pessimista).
- Relatórios + exportar PDF.
- Receitas por tipo (salário / aluguel / freela / dividendos).
- Orçado vs. realizado por categoria.
- Idiomas adicionais.

### Futuro — candidatos a premium
- **Sync entre dispositivos** (aqui entra conta opcional + possível assinatura).
- Acompanhamento de proventos / dividendos.
- Cronograma de dívidas / financiamento.
- **Módulo cross-border:** comparador de custo de vida entre países, impacto do câmbio no patrimônio, lembretes de obrigações fiscais (ex.: CRS, declarações de saída/entrada).
- Cotação de ativos em tempo real (preços de mercado).

## 6. Comunidade (como se constrói)
A comunidade — não o app — é o que vira base e receita. O app sozinho não retém; a comunidade sim.

**O loop (content-led / community-led):**
1. **Conteúdo** (YouTube / Instagram / TikTok / blog) sobre finanças cross-border e relocação — a jornada BR→Itália *é* o conteúdo.
2. O conteúdo leva ao **app gratuito**, que entrega valor real.
3. App e conteúdo capturam **e-mail (opt-in)** → a lista.
4. **Espaço de comunidade** (Discord / Telegram / Skool / Circle) onde expatriados trocam experiências.
5. A comunidade gera **confiança, feedback** (o que construir e o que vender) e **distribuição** (boca a boca).
6. A **monetização** nasce daí (premium, guias, consultoria, comunidade paga).

**Importante:** comunidade exige consistência de conteúdo — é compromisso, não efeito automático de o app existir. Começar com 1–2 canais bem feitos é melhor que 5 abandonados.

## 7. Estratégia de base e monetização
- App grátis + privado = isca e valor.
- Opt-in de e-mail = base.
- Nicho cross-border primeiro; ampliar depois.
- **Monetização (a definir, descoberta dos próprios usuários):** freemium/sync · expertise (guias / curso / consultoria, puxando para mcaliman.com) · comunidade paga · eventualmente B2B (agências de mobilidade, contadores).

## 8. Roadmap enxuto (mais barato primeiro)
1. **Landing + template grátis (a planilha) + opt-in de e-mail.** Custo ~zero; testa demanda e já inicia a lista.
2. **App client-side MVP** (porta a planilha) + opt-in + export/import.
3. **Conteúdo / comunidade em paralelo** (1–2 canais).
4. **Aprender com os usuários → introduzir a camada paga.**

## 9. Ativos que já existem
- **Planilha `Gestao_Patrimonial_Multimoeda_Template.xlsx`** — referência de lógica e UX (anexar no novo chat). 9 abas: Início, Painel, Patrimônio, Investimentos, Orçamento, Histórico, Objetivos, Projeção, Config.
- **mcaliman.com** — presença profissional / consultoria.
- **A jornada BR→Itália** — conteúdo e expertise (Regime Forfettario, câmbio, estrutura tributária).

## 10. Lógica a portar (para não reinventar)
- **Moeda de exibição:** cada item guarda a sua moeda; exibe convertido = `valor × taxa(moeda_item → moeda_exibição)`.
- **Câmbio:** tabela com a taxa de cada moeda → moeda base; converter entre duas moedas usando as duas taxas.
- **Projeção (juros compostos + aportes mensais):**
  - taxa mensal: `i = (1 + retorno_anual)^(1/12) − 1`
  - saldo no ano *t*: `inicial × (1+i)^(12t) + aporte × (((1+i)^(12t) − 1) / i)`  *(equivale a `FV(i, 12t, −aporte, −inicial)`)*
  - valor real (moeda de hoje): `saldo / (1 + inflação)^t`
- Categorias de despesa, metas com progresso, variação histórica e aportes — ver planilha.

## 11. Nome (a definir)
Placeholder. Direção: algo que evoque *global / multimoeda + simples + privado*. Decidir no novo chat.

## 12. Decisões em aberto (resolver no novo chat)
- Nome do produto.
- Stack exata (React/Vite vs. Svelte vs. vanilla).
- Idiomas no lançamento.
- Onde hospedar a comunidade.
- Qual monetização testar primeiro.
- Identidade visual (posso reaproveitar a paleta da planilha: navy `#243B53`, teal `#2C7A7B`, etc.).
