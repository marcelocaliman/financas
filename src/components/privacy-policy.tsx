import { useState, type ReactNode } from "react";
import { Dialog } from "@/components/common/dialog";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-[14px] font-semibold text-text">{title}</h3>
      <div className="text-[13px] text-muted leading-relaxed space-y-1.5">{children}</div>
    </section>
  );
}

/** Data da última revisão da política (mantenha em dia ao alterar o texto). */
export const PRIVACY_UPDATED = "Junho de 2026";

/** Conteúdo da política de privacidade — LGPD/GDPR + os LIMITES honestos do E2EE. */
export function PrivacyPolicyContent() {
  return (
    <div className="space-y-5">
      <p className="text-[12px] text-faint">Última atualização: {PRIVACY_UPDATED}</p>

      <Section title="Quem é o responsável">
        <p>
          O <b className="text-text">Nossas Finanças</b> (nossasfinancas.com.br) é o responsável
          (controlador) pelo tratamento dos seus dados pessoais. Você pode falar com o nosso{" "}
          <b className="text-text">Encarregado pela Proteção de Dados (DPO)</b> — e exercer qualquer
          direito abaixo — pelo e-mail <b className="text-text">privacidade@nossasfinancas.com.br</b>.
        </p>
      </Section>

      <Section title="Como protegemos seus dados">
        <p>
          Seus dados financeiros são <b className="text-text">cifrados no seu aparelho</b> (E2EE)
          com uma chave derivada da sua senha. O servidor recebe e guarda apenas{" "}
          <b className="text-text">texto cifrado</b> — nunca os seus valores em claro, nem a sua
          senha, nem a chave.
        </p>
      </Section>

      <Section title="Que dados tratamos">
        <p>
          • <b className="text-text">E-mail</b> — para criar a conta, autenticar e enviar e-mails
          essenciais (confirmação, redefinição de senha).
        </p>
        <p>
          • <b className="text-text">Cofre cifrado</b> — o blob com seus dados financeiros, já
          criptografado no seu aparelho. Para nós é texto ilegível.
        </p>
        <p>
          • <b className="text-text">Metadados técnicos mínimos</b> — tamanho aproximado do cofre,
          datas/versões de sincronização e logs de segurança do provedor. Sem perfis de
          comportamento, sem cookies de rastreio, sem anúncios.
        </p>
        <p>
          • <b className="text-text">Tickers de ativos</b> — se você usa cotação de ações, os
          códigos dos papéis (ex.: PETR4) passam pelo nosso servidor só para buscar o preço do dia.
          Não associamos isso às suas quantidades/valores (que seguem cifrados) e não os guardamos.
        </p>
        <p>
          • <b className="text-text">Mensagens de suporte</b> — se você abre um ticket (no app ou
          pelo formulário de contato), guardamos o seu e-mail e o conteúdo da mensagem em{" "}
          <b className="text-text">texto legível</b> (não são cifradas como o cofre), porque
          precisamos lê-las para responder. Por isso, não inclua senha, código de recuperação nem
          números de conta nessas mensagens. Imagens que você anexar ficam acessíveis por um link
          não-listado (não-adivinhável) — evite anexar conteúdo sensível.
        </p>
      </Section>

      <Section title="Base legal e finalidade">
        <p>
          Tratamos seu e-mail e o cofre cifrado para <b className="text-text">executar o serviço</b>{" "}
          que você contratou ao criar a conta (LGPD art. 7º, V / GDPR art. 6(1)(b)) e, quando você
          consente, com base no seu <b className="text-text">consentimento</b>. A finalidade é só
          fazer o app funcionar e sincronizar — nada além disso.
        </p>
      </Section>

      <Section title="Com quem compartilhamos">
        <p>Usamos prestadores que operam só para entregar o serviço, sob contrato:</p>
        <p>
          • <b className="text-text">Supabase</b> — autenticação e armazenamento do cofre cifrado.
        </p>
        <p>
          • <b className="text-text">Vercel</b> — hospedagem do app e a função que busca cotações.
        </p>
        <p>
          • <b className="text-text">Resend</b> — envio dos nossos e-mails (confirmação, redefinição
          de senha e notificações de suporte). Recebe só o seu e-mail e o conteúdo da mensagem.
        </p>
        <p>
          • <b className="text-text">APIs de câmbio/cotação</b> (Frankfurter, brapi) — recebem só
          pares de moeda e tickers, nunca dados pessoais ou financeiros. Não vendemos seus dados.
        </p>
      </Section>

      <Section title="Transferência internacional">
        <p>
          Esses provedores podem processar dados em servidores fora do Brasil/UE. Como o conteúdo
          financeiro vai sempre <b className="text-text">cifrado</b>, ele permanece ilegível onde
          quer que esteja armazenado.
        </p>
      </Section>

      <Section title="Por quanto tempo guardamos">
        <p>
          Enquanto a sua conta existir. Ao <b className="text-text">excluir a conta</b>, o cofre
          cifrado e o cadastro são apagados; backups dos provedores expiram nos ciclos deles.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          Só o <b className="text-text">essencial</b> para manter você logado (sessão de
          autenticação). Não usamos cookies de marketing, analytics invasivo ou rastreio entre
          sites.
        </p>
      </Section>

      <Section title="Métricas de uso (anônimas)">
        <p>
          Para entender o uso e melhorar o produto, registramos{" "}
          <b className="text-text">eventos não-identificáveis</b> (ex.: visita à landing, cadastro,
          abertura do app), o <b className="text-text">país</b> aproximado (o{" "}
          <b className="text-text">IP nunca é armazenado</b>) e o{" "}
          <b className="text-text">tipo de dispositivo</b>. É analytics de 1ª-parte,{" "}
          <b className="text-text">sem cookies</b> e <b className="text-text">nunca ligado à sua
          conta</b> — não há perfil individual, nem dado financeiro. Uma contagem anônima de
          sessões abertas pode aparecer como “online agora”, sem identificar ninguém. Base legal:
          legítimo interesse (LGPD art. 7º, IX / GDPR art. 6(1)(f)); você pode se opor.
        </p>
      </Section>

      <Section title="Seus direitos (LGPD/GDPR)">
        <p>
          Você é dono dos seus dados e pode, a qualquer momento:{" "}
          <b className="text-text">acessar e portar</b> (Config → Dados → Exportar/CSV),{" "}
          <b className="text-text">corrigir</b> (editando no app),{" "}
          <b className="text-text">excluir a conta</b> (Config → Conta, apaga o cofre para sempre) e{" "}
          <b className="text-text">revogar consentimento</b>. Para os demais direitos (confirmação,
          oposição, revisão) ou dúvidas, escreva para o contato acima — respondemos nos prazos da lei.
          Você também pode reclamar à autoridade de proteção de dados: a{" "}
          <b className="text-text">ANPD</b> (Brasil) ou, se estiver na União Europeia, a autoridade
          do seu país.
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
          irrecuperáveis.</b> É o que torna o app privado de verdade. A única forma de recuperar o
          cofre é o <b className="text-text">código de recuperação</b> — não há recuperação por
          e-mail do dado cifrado.
        </p>
      </Section>
    </div>
  );
}

/** Link que abre a política numa sobreposição (telas de auth + Config). */
export function PrivacyLink({ className, label = "Privacidade" }: { className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? "text-muted hover:text-text underline"}>
        {label}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Privacidade" wide>
        <PrivacyPolicyContent />
      </Dialog>
    </>
  );
}
