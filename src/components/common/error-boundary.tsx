import { Component, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { track } from "@/lib/analytics";

/**
 * Contém um crash de UMA seção — em vez de derrubar a página inteira (tela preta irrecuperável),
 * mostra o erro só naquele bloco e deixa o resto do app funcionando. Telemetria mínima e anônima:
 * só o NOME do erro (TypeError…) + a seção — nunca a mensagem (pode citar dado do usuário).
 */
class Boundary extends Component<
  { name: string; inline?: boolean; title: string; retry: string; children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[app] seção "${this.props.name}" falhou:`, error);
    track("app_error", { section: this.props.name, kind: error.name || "Error" });
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.inline) {
      // Versão COMPACTA (cabe no header de um accordion) — só sinaliza, sem card.
      return <span className="text-[11.5px] text-neg">{this.props.title}</span>;
    }
    return (
      <div className="rounded-[16px] border border-neg/30 bg-[var(--neg-soft)] p-5">
        <div className="text-[13.5px] font-semibold text-neg">{this.props.title}</div>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="mt-2.5 text-[12.5px] font-medium text-accent hover:underline outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded"
        >
          {this.props.retry}
        </button>
      </div>
    );
  }
}

/** Wrapper funcional: injeta as strings traduzidas no class component (que não usa hooks). */
export function SectionBoundary({ name, inline, children }: { name: string; inline?: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Boundary name={name} inline={inline} title={t("errors.sectionFailed")} retry={t("errors.retry")}>
      {children}
    </Boundary>
  );
}
