/**
 * Validação de CPF e CNPJ com algoritmo de dígitos verificadores (módulo 11).
 *
 * Centralizado aqui pra evitar drift entre formulários (declarantes,
 * dependentes, fontes pagadoras, membros do household, etc.).
 */

/** Remove tudo que não é dígito. */
export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** Formata CPF: 12345678901 → 123.456.789-01. Aceita string parcial. */
export function formatCPF(s: string): string {
  const d = digitsOnly(s).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Formata CNPJ: 12345678000199 → 12.345.678/0001-99. */
export function formatCNPJ(s: string): string {
  const d = digitsOnly(s).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  }
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/**
 * Valida CPF via dígitos verificadores. Rejeita números sequenciais
 * tipo 111.111.111-11 que passam no algoritmo mas são inválidos.
 */
export function isValidCPF(value: string): boolean {
  const cpf = digitsOnly(value);
  if (cpf.length !== 11) return false;
  // Rejeita números iguais (000..., 111..., etc.) — formalmente válidos mas
  // marcados como inválidos pela Receita por convenção.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // Primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i), 10) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(cpf.charAt(9), 10)) return false;

  // Segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i), 10) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === parseInt(cpf.charAt(10), 10);
}

/**
 * Valida CNPJ via dígitos verificadores. Rejeita números repetidos.
 */
export function isValidCNPJ(value: string): boolean {
  const cnpj = digitsOnly(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  // Pesos pra cada dígito
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(cnpj.charAt(i), 10) * weights1[i];
  let d1 = sum % 11;
  d1 = d1 < 2 ? 0 : 11 - d1;
  if (d1 !== parseInt(cnpj.charAt(12), 10)) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(cnpj.charAt(i), 10) * weights2[i];
  let d2 = sum % 11;
  d2 = d2 < 2 ? 0 : 11 - d2;
  return d2 === parseInt(cnpj.charAt(13), 10);
}

/**
 * Zod schemas reutilizáveis. Importar de `lib/financial/cpf-cnpj-zod`
 * (file separate to keep zod out of client bundles when desired).
 */

