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
export const TERMS_UPDATED = "Julho de 2026";

/**
 * Termos de Serviço (Termos de Uso) — linguagem simples e honesta, porém completa. ESPELHA a versão
 * pública em public/termos.html: ao mudar aqui, atualize o HTML (e a data) também. NÃO é texto
 * jurídico final: é uma base sólida; revise com um advogado antes do uso definitivo.
 */
export function TermsOfUseContent() {
  return (
    <div className="space-y-5">
      <p className="text-[12px] text-faint">Última atualização: {TERMS_UPDATED}</p>

      <Section title="1. Aceitação e quem opera o serviço">
        <p>
          Estes <b className="text-text">Termos de Serviço</b> (também Termos de Uso) regem o uso do{" "}
          <b className="text-text">Nossas Finanças</b> (nossasfinancas.com.br), app de organização
          financeira pessoal multimoeda com criptografia ponta a ponta (E2EE), operado por{" "}
          <b className="text-text">Marcelo Salgado Caliman</b> (pessoa física). Ao criar uma conta ou
          usar o app, você concorda com estes Termos e com a <b className="text-text">Política de
          Privacidade</b>, que é parte integrante deles. Se não concordar, não use o serviço.
        </p>
      </Section>

      <Section title="2. O que é o serviço">
        <p>
          É uma <b className="text-text">ferramenta de organização e cálculo</b> financeiro (patrimônio,
          orçamento, objetivos, projeções e indicadores como a “liberdade financeira”) a partir dos dados
          que <b className="text-text">você</b> insere. Há um <b className="text-text">núcleo gratuito</b> e
          um <b className="text-text">plano Pro pago opcional</b> (ver seção 8). Cotações, quando exibidas,
          são informativas, podem ter atraso e dependem de terceiros.
        </p>
      </Section>

      <Section title="3. Elegibilidade">
        <p>
          Você deve ter <b className="text-text">18 anos ou mais</b> e plena capacidade civil — ou{" "}
          <b className="text-text">16+ com consentimento e supervisão dos responsáveis</b>. Ao usar o app,
          você declara cumprir esses requisitos e fornecer informações verdadeiras.
        </p>
      </Section>

      <Section title="4. Não é aconselhamento financeiro">
        <p>
          Os números, projeções e indicadores são <b className="text-text">informativos e educacionais</b> e
          dependem dos dados e premissas que você informa. <b className="text-text">Não constituem
          aconselhamento financeiro, de investimento, tributário, contábil ou jurídico</b>, nem recomendação
          de compra ou venda. As decisões são suas; consulte um profissional habilitado.
        </p>
      </Section>

      <Section title="5. Sua conta, senha e código de recuperação">
        <p>
          • Você é responsável por manter a <b className="text-text">senha</b> e o{" "}
          <b className="text-text">código de recuperação</b> em segurança e pela atividade na conta. Como o
          app é E2EE, a chave que abre seus dados nasce da sua senha e nunca vai ao servidor.
        </p>
        <p>
          • <b className="text-text">Perder a senha E o código = perder o acesso aos dados de forma
          definitiva — nem nós recuperamos</b>. É o preço da privacidade real.
        </p>
        <p>
          • Você responde pela <b className="text-text">exatidão</b> dos dados e por usar o app de forma
          lícita. Recomendamos <b className="text-text">exportar backups</b> (Config → Dados). Os dados são seus.
        </p>
      </Section>

      <Section title="6. Uso aceitável">
        <p>
          Você concorda em não: usar o serviço para fins ilícitos; violar direitos de terceiros ou a lei;
          burlar a segurança, a criptografia ou os limites de uso; sobrecarregar/abusar da infraestrutura
          (automação abusiva, raspagem, engenharia reversa não autorizada); ou revender/redistribuir o serviço
          sem autorização. Podemos <b className="text-text">suspender ou encerrar</b> contas que descumpram isto.
        </p>
      </Section>

      <Section title="7. Propriedade intelectual">
        <p>
          O software, a marca, o design e os textos são de <b className="text-text">titularidade do
          operador</b>. Concedemos a você uma licença <b className="text-text">pessoal, limitada, não
          exclusiva, intransferível e revogável</b> de uso conforme estes Termos. Já os{" "}
          <b className="text-text">dados que você insere continuam seus</b> — não reivindicamos propriedade e,
          por serem cifrados, sequer conseguimos lê-los.
        </p>
      </Section>

      <Section title="8. Plano Pro e assinatura">
        <p>
          • O núcleo é <b className="text-text">gratuito</b>. O <b className="text-text">Pro</b> (opcional)
          desbloqueia recursos avançados, com assinatura <b className="text-text">mensal (R$ 24,90)</b> ou{" "}
          <b className="text-text">anual (R$ 249)</b>, via <b className="text-text">Stripe</b>. Os dados do
          cartão vão direto à Stripe; nós nunca os vemos nem armazenamos.
        </p>
        <p>
          • <b className="text-text">Teste grátis</b>: uma vez por conta, 14 dias. Ao fim, a cobrança é
          automática, salvo cancelamento antes.
        </p>
        <p>
          • <b className="text-text">Renovação/cancelamento</b>: renova automaticamente; cancele quando quiser
          em Config → Plano. O acesso segue até o fim do período pago; <b className="text-text">sem cobranças
          futuras</b> após cancelar.
        </p>
        <p>
          • <b className="text-text">Reembolso</b>: períodos já pagos não são reembolsados — o cancelamento só
          interrompe as cobranças seguintes, sem afastar direitos legais aplicáveis (ex.: CDC).
        </p>
        <p>
          • <b className="text-text">Falha de pagamento</b>: a Stripe tenta de novo; persistindo, a assinatura
          é suspensa e o Pro desativado até regularizar — <b className="text-text">sem perder seus dados</b>.
        </p>
        <p>• Os preços podem mudar; alterações valem para ciclos futuros, com aviso prévio razoável.</p>
      </Section>

      <Section title="9. Serviços de terceiros">
        <p>
          O serviço se apoia em <b className="text-text">Supabase</b> (auth + cofre cifrado),{" "}
          <b className="text-text">Vercel</b> (hospedagem), <b className="text-text">Stripe</b> (pagamentos),{" "}
          <b className="text-text">Resend</b> (e-mails), <b className="text-text">Cloudflare Turnstile</b>{" "}
          (anti-spam) e <b className="text-text">APIs de câmbio/cotação</b> (Frankfurter, brapi, Finnhub,
          Coinbase). O uso deles também se sujeita aos seus termos; não respondemos por indisponibilidade ou
          erros de terceiros fora do nosso controle.
        </p>
      </Section>

      <Section title="10. Disponibilidade e “no estado em que se encontra”">
        <p>
          O serviço é oferecido <b className="text-text">“no estado em que se encontra” e “conforme
          disponível”</b>, sem garantia de operação ininterrupta ou livre de erros. Podemos alterar, suspender
          ou descontinuar funcionalidades — avisando com antecedência razoável quando relevante. Recursos de
          terceiros podem variar ou ficar indisponíveis.
        </p>
      </Section>

      <Section title="11. Isenção de garantias e limitação de responsabilidade">
        <p>
          Na máxima extensão permitida por lei, o serviço é fornecido <b className="text-text">sem
          garantias</b>. Não nos responsabilizamos por perdas decorrentes do uso ou da impossibilidade de uso,
          de decisões tomadas com base nele, de indisponibilidade, de dados imprecisos informados por você ou
          de cotações de terceiros, nem pela <b className="text-text">perda de acesso por extravio da
          senha/código</b>.
        </p>
        <p>
          Onde a limitação total não for permitida, a responsabilidade agregada fica limitada ao{" "}
          <b className="text-text">valor pago por você nos 12 meses anteriores</b> ao fato (e a nada, no plano
          gratuito). <b className="text-text">Nada aqui afasta direitos irrenunciáveis do consumidor</b> (CDC/LGPD).
        </p>
      </Section>

      <Section title="12. Indenização">
        <p>
          Você concorda em <b className="text-text">indenizar e isentar</b> o operador de reclamações, perdas e
          despesas decorrentes do seu uso indevido do serviço, da violação destes Termos ou de direitos de
          terceiros/da lei por você.
        </p>
      </Section>

      <Section title="13. Comunidade">
        <p>
          Participar da comunidade (ex.: Discord) é <b className="text-text">opcional</b> e segue as regras do
          espaço e da plataforma. Conteúdo de outros participantes é de responsabilidade de quem publica;{" "}
          <b className="text-text">não endossamos nem respondemos</b> por opiniões de terceiros, e nada ali é
          aconselhamento financeiro.
        </p>
      </Section>

      <Section title="14. Encerramento e suspensão">
        <p>
          Você pode <b className="text-text">excluir a conta</b> quando quiser (Config → Conta), apagando o
          cofre cifrado de forma definitiva. Podemos suspender/encerrar contas que violem estes Termos ou a lei.
          As cláusulas que por natureza sobrevivem (propriedade intelectual, limitação, indenização, lei
          aplicável) permanecem em vigor.
        </p>
      </Section>

      <Section title="15. Privacidade">
        <p>
          O tratamento dos seus dados é regido pela nossa <b className="text-text">Política de
          Privacidade</b>, parte integrante destes Termos.
        </p>
      </Section>

      <Section title="16. Alterações destes Termos">
        <p>
          Podemos atualizar estes Termos; a data acima indica a versão vigente. Mudanças relevantes serão
          comunicadas por meios razoáveis, e o <b className="text-text">uso continuado</b> após a nova versão
          significa concordância.
        </p>
      </Section>

      <Section title="17. Lei aplicável e foro">
        <p>
          Regidos pelas <b className="text-text">leis do Brasil</b>. Em relações de consumo, fica assegurado ao
          usuário o <b className="text-text">foro do seu domicílio</b> (CDC). Buscaremos resolver controvérsias
          amigavelmente pelo <b className="text-text">contato@nossasfinancas.com.br</b> antes de medida judicial.
        </p>
      </Section>

      <Section title="18. Disposições gerais">
        <p>
          Se uma cláusula for inválida, as demais permanecem. Tolerar um descumprimento não é renúncia a
          direitos. Você não pode ceder estes Termos sem anuência; podemos cedê-los em caso de reorganização,
          preservados os seus direitos. Estes Termos e a Política de Privacidade são o{" "}
          <b className="text-text">acordo integral</b> quanto ao serviço.
        </p>
      </Section>

      <Section title="19. Contato">
        <p>
          Dúvidas sobre estes Termos? Escreva para <b className="text-text">contato@nossasfinancas.com.br</b>.
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
