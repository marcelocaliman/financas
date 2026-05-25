"use client";

/**
 * Checkbox pra excluir um bem específico da declaração IRPF.
 *
 * Default: false (declarável). Quando marcado:
 * - O bem fica visível no app pra controle pessoal
 * - Não aparece em /ir (relatório Bens e Direitos)
 * - Não vai pro .DEC exportado
 *
 * Casos comuns: bicicletas, joias pequenas, equipamentos eletrônicos
 * que o usuário não quer declarar (deveria, mas não vai).
 */
export function ExcludeFromIrToggle({
  defaultValue = false,
  name = "excludeFromIr",
}: {
  defaultValue?: boolean;
  name?: string;
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer rounded-[8px] bg-bone-50 dark:bg-ink-900 border border-border px-3 py-2.5 text-[12.5px]">
      <input
        type="checkbox"
        name={name}
        value="1"
        defaultChecked={defaultValue}
        className="mt-0.5 accent-navy-700"
      />
      <span>
        <b className="text-foreground">Não declarar no IRPF</b>
        <span className="block text-faint-foreground text-[11.5px] mt-0.5">
          Bem fica no app pra controle pessoal mas é excluído dos relatórios e
          do arquivo .DEC. Use pra coisas que você escolheu não declarar.
        </span>
      </span>
    </label>
  );
}
