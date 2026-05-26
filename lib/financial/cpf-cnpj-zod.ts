import { z } from "zod";
import { digitsOnly, isValidCPF, isValidCNPJ } from "@/lib/financial/cpf-cnpj";

/**
 * CPF obrigatório (11 dígitos, com checksum válido). Aceita máscara,
 * normaliza pra dígitos puros no output.
 */
export const cpfRequired = z
  .string()
  .transform((s) => digitsOnly(s))
  .refine((s) => s.length === 11, "CPF deve ter 11 dígitos.")
  .refine(isValidCPF, "CPF inválido (dígito verificador não bate).");

/**
 * CPF opcional. Aceita string vazia/null/undefined → vira null.
 * Se preenchido, exige checksum válido.
 */
export const cpfOptional = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((s) => (s ? digitsOnly(s) : null))
  .refine(
    (s) => s === null || (s.length === 11 && isValidCPF(s)),
    "CPF inválido.",
  );

/**
 * CNPJ obrigatório (14 dígitos, checksum válido).
 */
export const cnpjRequired = z
  .string()
  .transform((s) => digitsOnly(s))
  .refine((s) => s.length === 14, "CNPJ deve ter 14 dígitos.")
  .refine(isValidCNPJ, "CNPJ inválido (dígito verificador não bate).");

/**
 * CNPJ opcional. Aceita vazio → null. Se preenchido, exige checksum.
 */
export const cnpjOptional = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((s) => (s ? digitsOnly(s) : null))
  .refine(
    (s) => s === null || (s.length === 14 && isValidCNPJ(s)),
    "CNPJ inválido.",
  );

/**
 * CPF OU CNPJ (pra fontes pagadoras genéricas, prior-year balances, etc.)
 * Aceita ambas as máscaras, valida pelo length detectado.
 */
export const cpfOrCnpjOptional = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((s) => (s ? digitsOnly(s) : null))
  .refine(
    (s) => {
      if (s === null) return true;
      if (s.length === 11) return isValidCPF(s);
      if (s.length === 14) return isValidCNPJ(s);
      return false;
    },
    "CPF ou CNPJ inválido.",
  );
