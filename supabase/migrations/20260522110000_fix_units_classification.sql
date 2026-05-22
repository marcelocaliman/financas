-- Corrige classificação de Units (XXXX11 que são ações, não FIIs).
-- Tickers que historicamente caíram na heurística como FII e devem ser stock.

update investments
set asset_type = 'stock'
where upper(ticker) in (
  'KLBN11', 'SAPR11', 'TAEE11', 'ALUP11', 'ENGI11',
  'BIDI11', 'SANB11', 'PINE11'
)
and asset_type = 'fii';
