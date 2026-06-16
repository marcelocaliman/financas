# Categorias e Modelo de Dados — Ativos e Passivos
> Default rico para semear o app. TUDO editável pelo usuário no Config (adicionar / renomear / remover).
> As listas viram os dropdowns das tabelas. O Subtipo é cascata da Classe selecionada.

## Modelo — Ativo
Campos por ativo:
- **Nome** (texto livre) — ex.: "Tesouro IPCA+ 2035", "PETR4", "Apartamento Botafogo"
- **Classe** (obrigatório) — bucket de alocação
- **Subtipo** (opcional) — instrumento específico, em cascata da Classe
- **Região/País** (opcional) — localização do ativo (resolve Brasil vs Itália na alocação)
- **Moeda** (obrigatório) — BRL / EUR / USD / ...
- **Valor atual** (obrigatório) — na moeda do ativo
- **Indexador** (opcional, p/ Renda Fixa) — Prefixado / CDI / IPCA / Selic
- **Instituição** (opcional) — corretora / banco

## Classes (buckets de alocação)
1. Renda Fixa
2. Ações
3. Fundos Imobiliários (FIIs/REITs)
4. Multimercado
5. Previdência
6. Cripto
7. Commodities / Ouro
8. Caixa e Liquidez
9. Imóveis (físicos)
10. Private Equity / Alternativos
11. Outros

> Localização NÃO é classe — vai no campo Região. Assim "Renda Fixa · Brasil" e
> "Renda Fixa · Itália" são a mesma classe em regiões diferentes (resolve o bucket único
> "Exterior" da planilha).

## Subtipos por Classe (cascata)
- **Renda Fixa:** Tesouro Selic (LFT) · Tesouro Prefixado (LTN) · Tesouro IPCA+ (NTN-B) · CDB ·
  LCI · LCA · CRI · CRA · Debênture · Debênture incentivada · Letra de Câmbio (LC) ·
  Fundo de Renda Fixa · Fundo DI · Bond/Título internacional · Outro
- **Ações:** Ação (BR) · Stock (internacional) · BDR · ETF de ações · Fundo de ações · Outro
- **Fundos Imobiliários (FIIs/REITs):** FII de tijolo · FII de papel · FII de fundos (FOF) ·
  REIT internacional · FI-Infra · Outro
- **Multimercado:** Fundo multimercado · Long & short · Macro · Hedge fund · Outro
- **Previdência:** PGBL · VGBL · Fundo de previdência · Plano fechado (empresa) · Outro
- **Cripto:** Bitcoin · Ethereum · Altcoins · Stablecoin · Fundo cripto · Outro
- **Commodities / Ouro:** Ouro · Prata · ETF de ouro/commodities · Fundo de commodities · Outro
- **Caixa e Liquidez:** Conta corrente · Conta poupança · Conta internacional · Money market ·
  Reserva de emergência · Outro
- **Imóveis (físicos):** Residencial · Comercial · Terreno · Imóvel de aluguel · Outro
- **Private Equity / Alternativos:** Private equity · Venture capital · Participação em empresa ·
  Arte/colecionáveis · Outro
- **Outros:** (livre)

## Região / País
Brasil · Itália · Zona do Euro (outros) · Estados Unidos · Reino Unido · Global/Mundo · Outro

## Moedas (seed)
BRL (R$) · EUR (€) · USD (US$) · GBP (£) — editável.

## Modelo — Passivo
Campos por passivo:
- **Nome** (texto livre)
- **Tipo** (obrigatório)
- **Moeda** (obrigatório)
- **Saldo devedor** (obrigatório)
- **Taxa de juros** (opcional)
- **Parcelas restantes** (opcional)

### Tipos de Passivo
Financiamento imobiliário · Financiamento de veículo · Empréstimo pessoal · Empréstimo consignado ·
Cartão de crédito · Cheque especial · Crédito estudantil · Parcelamento · Impostos a pagar ·
Outras dívidas

## Regras
- Tudo acima é DEFAULT editável no Config (adicionar / renomear / remover classes, subtipos,
  regiões, moedas e tipos de passivo). Mudou no Config → muda nos dropdowns.
- Subtipo é cascata: as opções dependem da Classe escolhida.
- Obrigatórios mínimos — Ativo: Nome, Classe, Moeda, Valor. Passivo: Nome, Tipo, Moeda, Saldo.
  O resto é refinamento opcional; entrada rápida não exige preencher tudo.
- Alocação / rebalanceamento pode agrupar por Classe e/ou por Região.
