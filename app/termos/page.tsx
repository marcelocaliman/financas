import Link from "next/link";
import { BrandMark } from "@/components/layout/brand-mark";
import { TERMS_VERSION } from "@/services/lgpd";

export const metadata = {
  title: "Termos de Uso · Finanças",
};

const contactEmail =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "marcelo.salgado.caliman@gmail.com";

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-[800px] mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/">
            <BrandMark size="md" tone="dark" />
          </Link>
          <Link
            href="/dashboard"
            className="text-[12.5px] text-navy-700 dark:text-navy-300"
          >
            Voltar ao app →
          </Link>
        </div>
      </header>

      <main className="max-w-[760px] mx-auto px-6 py-12">
        <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-faint-foreground mb-2">
          Documento legal · v{TERMS_VERSION} · vigente desde 2026-05-24
        </div>
        <h1 className="font-display text-[36px] tracking-[-0.025em] mb-8 leading-tight">
          Termos de Uso
        </h1>

        <div className="space-y-5 text-[14px] leading-relaxed text-foreground">
          <Section title="1. Aceitação">
            <p>
              Ao criar conta no Finanças, vc aceita estes Termos de Uso e a{" "}
              <Link href="/privacidade" className="text-navy-700 dark:text-navy-300">
                Política de Privacidade
              </Link>
              . Se não concordar, não use o app.
            </p>
          </Section>

          <Section title="2. O que é o Finanças">
            <p>
              Finanças é uma ferramenta de gestão financeira pessoal. Permite registrar
              transações, planejar metas, acompanhar investimentos e visualizar o patrimônio.
              <b> Não é uma instituição financeira, corretora, banco ou consultoria de
              investimentos.</b> Não executa transferências, ordens de compra/venda nem dá
              recomendações personalizadas.
            </p>
          </Section>

          <Section title="3. Cadastro e conta">
            <ul>
              <li>Você deve ter ao menos 18 anos.</li>
              <li>Informações fornecidas devem ser verdadeiras e atualizadas.</li>
              <li>Vc é responsável pela segurança da sua senha.</li>
              <li>Cada conta pertence a uma pessoa física ou casal (household).</li>
              <li>Vc pode convidar outras pessoas pro seu household conforme limites do plano.</li>
            </ul>
          </Section>

          <Section title="4. Uso permitido">
            <p>Vc pode usar o app pra:</p>
            <ul>
              <li>Registrar e categorizar suas finanças pessoais.</li>
              <li>Planejar metas e visualizar projeções.</li>
              <li>Exportar seus próprios dados a qualquer momento.</li>
            </ul>
            <p>Vc NÃO pode:</p>
            <ul>
              <li>Tentar acessar dados de outros usuários.</li>
              <li>Aplicar engenharia reversa, descompilar ou clonar o código.</li>
              <li>Sobrecarregar a infraestrutura (scraping massivo, ataques DoS).</li>
              <li>Usar o app pra fins ilegais (lavagem de dinheiro, evasão fiscal etc).</li>
            </ul>
          </Section>

          <Section title="5. Conteúdo e propriedade intelectual">
            <p>
              Os dados que vc registra são SEUS. Vc concede ao Finanças licença não-exclusiva
              pra processar, armazenar e exibir esses dados unicamente pra prover o serviço.
              O código-fonte do app, a marca e o design são de propriedade do desenvolvedor.
            </p>
          </Section>

          <Section title="6. Planos e cobrança">
            <p>
              Atualmente o Finanças é gratuito (validação de produto). Quando planos pagos
              forem introduzidos, vc receberá aviso prévio e poderá optar por continuar no
              plano gratuito (com possíveis limitações) ou migrar pra um plano pago.
            </p>
            <p>
              Pagamentos serão processados via Stripe. Cancelamento pode ser feito a qualquer
              momento sem multa, com acesso garantido até o fim do período pago.
            </p>
          </Section>

          <Section title="7. Disclaimer financeiro">
            <p>
              <b>O Finanças NÃO é consultoria de investimento.</b> Cálculos de rendimento,
              projeções de patrimônio, simulações de financiamento e qualquer outra projeção
              são <b>estimativas baseadas em dados públicos</b> (Selic do BCB, brapi.dev) e
              em parâmetros que vc fornece.
            </p>
            <p>
              <b>Resultados passados não garantem retornos futuros.</b> Decisões de
              investimento, compra de imóvel, financiamento ou qualquer ação financeira são
              de sua inteira responsabilidade.
            </p>
            <p>
              <b>Sempre consulte profissionais qualificados</b> (contador, advogado tributário,
              consultor financeiro CVM) antes de decisões de alto valor.
            </p>
          </Section>

          <Section title="8. Limitação de responsabilidade">
            <p>
              O Finanças é fornecido &ldquo;como está&rdquo;. Não nos responsabilizamos por:
            </p>
            <ul>
              <li>Decisões financeiras tomadas com base em dados/projeções do app.</li>
              <li>Perdas decorrentes de erros de cálculo, indisponibilidade do serviço ou bugs.</li>
              <li>Imprecisão de dados de terceiros (brapi.dev, BCB).</li>
              <li>Danos indiretos, lucros cessantes, danos morais.</li>
            </ul>
            <p>
              A responsabilidade total do Finanças por qualquer reclamação está limitada ao
              valor pago por vc nos últimos 12 meses (zero se vc estiver no plano gratuito).
            </p>
          </Section>

          <Section title="9. Indisponibilidade e manutenção">
            <p>
              Faremos esforços razoáveis pra manter o app disponível 24/7, mas não garantimos
              uptime de 100%. Manutenções programadas serão comunicadas com antecedência
              quando possível. Falhas pontuais podem ocorrer.
            </p>
          </Section>

          <Section title="10. Encerramento">
            <p>
              Vc pode encerrar sua conta a qualquer momento em{" "}
              <Link href="/configuracoes/privacidade" className="text-navy-700 dark:text-navy-300">
                /configuracoes/privacidade
              </Link>
              .
            </p>
            <p>
              Podemos suspender ou encerrar contas que violem estes Termos, com aviso prévio
              quando aplicável. Em casos graves (fraude, ataques), encerramento pode ser
              imediato.
            </p>
          </Section>

          <Section title="11. Alterações">
            <p>
              Estes Termos podem ser atualizados. Mudanças relevantes serão comunicadas com
              30 dias de antecedência e vc precisará re-aceitar no próximo login. Se discordar,
              poderá encerrar a conta e baixar seus dados.
            </p>
          </Section>

          <Section title="12. Foro">
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Foro:
              comarca do domicílio do usuário (CDC quando aplicável) ou São Paulo/SP.
            </p>
          </Section>

          <Section title="13. Contato">
            <p>
              Dúvidas:{" "}
              <a href={`mailto:${contactEmail}`} className="text-navy-700 dark:text-navy-300">
                {contactEmail}
              </a>
            </p>
          </Section>

          <div className="border-t border-border pt-6 mt-10">
            <p className="text-[12.5px] text-faint-foreground italic">
              Estes termos são uma versão inicial elaborada de boa fé. Antes de operar como
              SaaS comercial em escala, recomenda-se revisão por advogado especialista.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-[20px] tracking-[-0.02em] mb-2 mt-6">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
