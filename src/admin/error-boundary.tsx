import { Component, type ReactNode } from "react";

/** Contém um crash de uma seção do painel — em vez de derrubar o app inteiro (tela preta),
 *  mostra o erro só naquele bloco e deixa o resto do painel funcionando. */
export class SectionErrorBoundary extends Component<
  { name: string; children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[admin] seção "${this.props.name}" falhou:`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-[16px] border border-neg/30 bg-[var(--neg-soft)] p-5">
          <div className="text-[13.5px] font-semibold text-neg">Esta seção falhou ao carregar.</div>
          <div className="text-[12px] text-muted mt-1.5 break-all leading-relaxed">{this.state.error.message}</div>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="mt-3 text-[12.5px] font-medium text-accent hover:underline"
          >
            Tentar de novo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
