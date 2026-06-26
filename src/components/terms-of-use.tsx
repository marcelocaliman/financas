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

/** Data da última revisão dos termos (mantenha em dia ao alterar o texto). */
export const TERMS_UPDATED = "Junho de 2026";

/**
 * Termos de Uso — versão em linguagem simples e honesta. NÃO é texto jurídico final:
 * é um ponto de partida; revise com um advogado antes do uso definitivo.
 */
export function TermsOfUseContent() {
  return (
    <div className="space-y-5">
      <p className="text-[12px] text-faint">Última atualização: {TERMS_UPDATED}</p>

      <Section title="O que é o serviço">
        <p>
          O <b className="text-text">Nossas Finanças</b> (nossasfinancas.com.br) é um app de
          organização financeira pessoal multimoeda, com criptografia ponta a ponta (E2EE).
          Oferecemos um <b className="text-text">núcleo gratuito</b> e um{" "}
          <b className="text-text">plano Pro pago opcional</b> com recursos avançados (ver
          “Plano Pro e assinatura”). Ao criar uma conta e usar o app, você concorda com estes
          Termos. Se não concordar, não use o serviço.
        </p>
      </Section>

      <Section title="Não é aconselhamento">
        <p>
          O app é uma <b className="text-text">ferramenta de organização e cálculo</b>. Os números,
          projeções e indicadores (incluindo a métrica de “liberdade financeira”) são informativos e
          dependem dos dados e premissas que você informa. <b className="text-text">Não constituem
          aconselhamento financeiro, de investimento, contábil ou jurídico.</b> Decisões são suas;
          para casos específicos, consulte um profissional habilitado.
        </p>
      </Section>

      <Section title="Sua conta e responsabilidades">
        <p>
          • Você é responsável por manter a sua <b className="text-text">senha</b> e o seu{" "}
          <b className="text-text">código de recuperação</b> em segurança. Como o app é E2EE,{" "}
          <b className="text-text">perder os dois significa perder o acesso aos dados — sem
          recuperação possível</b>.
        </p>
        <p>• Você é responsável pela exatidão dos dados que insere e por usar o app de forma lícita.</p>
        <p>
          • Recomendamos <b className="text-text">exportar backups</b> (Config → Dados) com
          regularidade. Você é o dono dos seus dados.
        </p>
      </Section>

      <Section title="Uso aceitável">
        <p>
          Não use o serviço para fins ilícitos, para abusar da infraestrutura (ex.: automação
          abusiva, tentativas de burlar a segurança ou os limites de uso) nem para violar direitos de
          terceiros. Podemos suspender contas que façam isso.
        </p>
      </Section>

      <Section title="Disponibilidade e mudanças">
        <p>
          O serviço é oferecido <b className="text-text">“no estado em que se encontra”</b>, sem
          garantia de disponibilidade ininterrupta. Podemos alterar, suspender ou descontinuar
          funcionalidades — buscando avisar com antecedência razoável quando a mudança for relevante.
          Recursos dependentes de terceiros (ex.: cotações) podem variar ou ficar indisponíveis.
        </p>
      </Section>

      <Section title="Limitação de responsabilidade">
        <p>
          Na máxima extensão permitida pela lei, o serviço é fornecido sem garantias e{" "}
          <b className="text-text">não nos responsabilizamos por perdas decorrentes do uso</b>,
          de decisões tomadas com base nele, de indisponibilidade, de dados imprecisos informados por
          você, ou da perda de acesso por extravio da senha/código de recuperação.
        </p>
      </Section>

      <Section title="Encerramento">
        <p>
          Você pode <b className="text-text">excluir a sua conta</b> a qualquer momento (Config →
          Conta), o que apaga o cofre cifrado de forma definitiva. Podemos encerrar contas em caso de
          violação destes Termos.
        </p>
      </Section>

      <Section title="Plano Pro e assinatura">
        <p>
          • O núcleo do app é <b className="text-text">gratuito</b>. O <b className="text-text">plano Pro</b>{" "}
          (opcional) desbloqueia recursos avançados, com assinatura <b className="text-text">mensal (R$ 24,90)</b> ou{" "}
          <b className="text-text">anual (R$ 249)</b>, processada pela <b className="text-text">Stripe</b>.
        </p>
        <p>
          • <b className="text-text">Teste grátis</b>: uma vez por conta, você pode iniciar 14 dias de teste do Pro.
          Ao fim do teste, a cobrança é automática, salvo cancelamento antes.
        </p>
        <p>
          • <b className="text-text">Cancelamento</b>: a qualquer momento em Config → Plano. O acesso Pro continua
          até o fim do período já pago; <b className="text-text">não há cobranças futuras</b> após o cancelamento.
        </p>
        <p>
          • <b className="text-text">Reembolso</b>: períodos já pagos não são reembolsados — o cancelamento apenas
          interrompe as cobranças seguintes. Dúvidas pontuais: <b className="text-text">contato@nossasfinancas.com.br</b>.
        </p>
        <p>
          • <b className="text-text">Falha de pagamento</b>: se o cartão for recusado, a Stripe tenta de novo;
          persistindo, a assinatura fica suspensa e o Pro é desativado até a regularização — <b className="text-text">sem perder
          seus dados</b>.
        </p>
        <p>• Os preços podem mudar; alterações valem para ciclos futuros, com aviso prévio razoável.</p>
      </Section>

      <Section title="Privacidade">
        <p>
          O tratamento dos seus dados é regido pela nossa <b className="text-text">Política de
          Privacidade</b>, que faz parte destes Termos.
        </p>
      </Section>

      <Section title="Alterações destes Termos">
        <p>
          Podemos atualizar estes Termos; a data de “última atualização” acima indica a versão
          vigente. O uso continuado após mudanças significa concordância com a versão nova.
        </p>
      </Section>

      <Section title="Lei aplicável e contato">
        <p>
          Estes Termos são regidos pelas leis do <b className="text-text">Brasil</b>. Dúvidas? Escreva
          para <b className="text-text">contato@nossasfinancas.com.br</b>.
        </p>
      </Section>
    </div>
  );
}

/** Link que abre os Termos numa sobreposição (telas de auth + Config + rodapé). */
export function TermsLink({ className, label = "Termos de Uso" }: { className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? "text-muted hover:text-text underline"}>
        {label}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Termos de Uso" wide>
        <TermsOfUseContent />
      </Dialog>
    </>
  );
}
