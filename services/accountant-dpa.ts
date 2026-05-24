import { createHash } from "crypto";

/**
 * Termo de tratamento de dados pessoais aceito pelo contador no onboarding.
 * Versão atual: 1.0. Se mudar, gera hash novo e força reaceite.
 */
export const DPA_TERMS_TEXT = `
Termo de Tratamento de Dados Pessoais — Contador
v1.0 · 2026-05-24

Ao aceitar este termo, o contador declara:
1. Atua como agente de tratamento de dados pessoais do titular para fins
   exclusivos de preparação e apresentação da declaração de imposto de renda
   (IRPF) referente aos anos-base liberados pelo titular.
2. Compromete-se a usar os dados acessados única e exclusivamente para a
   finalidade acima, observando a Lei Geral de Proteção de Dados (LGPD,
   Lei nº 13.709/2018).
3. Não compartilhará, copiará ou utilizará os dados para qualquer outra
   finalidade ou com qualquer outro destinatário.
4. Reconhece que todas as ações (visualização, exportação) ficam registradas
   em log auditável compartilhado com o titular.
5. O acesso pode ser revogado a qualquer momento pelo titular, com efeito
   imediato.
6. Em caso de descumprimento, responderá civil e criminalmente nos termos
   da legislação aplicável.
`.trim();

export const DPA_TERMS_HASH = createHash("sha256").update(DPA_TERMS_TEXT).digest("hex");

export function getDPATerms(): { text: string; hash: string } {
  return { text: DPA_TERMS_TEXT, hash: DPA_TERMS_HASH };
}
