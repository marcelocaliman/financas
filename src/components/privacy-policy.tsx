import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Panel } from "@/components/common/panel";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-[14px] font-semibold text-text">{title}</h3>
      <div className="text-[13px] text-muted leading-relaxed space-y-1.5">{children}</div>
    </section>
  );
}

/** Conteúdo da política de privacidade — com os LIMITES honestos do E2EE. */
export function PrivacyPolicyContent() {
  return (
    <div className="space-y-5">
      <Section title="Como protegemos seus dados">
        <p>
          Seus dados financeiros são <b className="text-text">cifrados no seu aparelho</b> (E2EE)
          com uma chave derivada da sua senha. O servidor recebe e guarda apenas{" "}
          <b className="text-text">texto cifrado</b> — nunca os seus valores em claro, nem a sua
          senha, nem a chave.
        </p>
      </Section>
      <Section title="O que o servidor consegue ver">
        <p>
          Seu e-mail (pra login) e o blob cifrado (tamanho aproximado e datas de sincronização).{" "}
          <b className="text-text">Não</b> consegue ler suas transações, saldos, ou qualquer dado
          financeiro.
        </p>
      </Section>
      <Section title="Limites honestos (leia)">
        <p>
          • O E2EE protege a cópia no <b className="text-text">servidor</b>, não o seu aparelho: no
          seu navegador os dados ficam legíveis enquanto o cofre está destravado.
        </p>
        <p>• A senha de login trafega ao provedor de autenticação por TLS (modelo padrão).</p>
        <p>
          • Risco residual de código malicioso no navegador (XSS) — mitigado por uma política de
          segurança estrita, não eliminado.
        </p>
        <p>
          • <b className="text-text">Perder a senha E o código de recuperação = dados
          irrecuperáveis.</b> É o que torna o app privado de verdade.
        </p>
      </Section>
      <Section title="Recuperação">
        <p>
          A única forma de recuperar o cofre se você esquecer a senha é o{" "}
          <b className="text-text">código de recuperação</b>. Não há recuperação por e-mail do dado
          cifrado.
        </p>
      </Section>
      <Section title="Seus direitos (LGPD/GDPR)">
        <p>
          Você é dono dos seus dados: pode exportá-los e <b className="text-text">excluir a conta</b>{" "}
          a qualquer momento (apaga o cofre cifrado para sempre). Não há rastreamento nem anúncios.
        </p>
      </Section>
    </div>
  );
}

/** Link que abre a política numa sobreposição (telas de auth + Config). */
export function PrivacyLink({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? "text-muted hover:text-text underline"}>
        Privacidade
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto px-4 py-8">
          <Panel className="w-full max-w-lg p-6 my-auto">
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-[16px] font-bold text-text">Privacidade</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="text-muted hover:text-text">
                <X size={18} />
              </button>
            </div>
            <PrivacyPolicyContent />
          </Panel>
        </div>
      ) : null}
    </>
  );
}
