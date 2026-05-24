import Link from "next/link";
import { BrandMark } from "@/components/layout/brand-mark";
import { PRIVACY_VERSION } from "@/services/lgpd";

export const metadata = {
  title: "Política de Privacidade · Finanças",
};

export default function PoliticaPrivacidadePage() {
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
          Documento legal · v{PRIVACY_VERSION} · vigente desde 2026-05-24
        </div>
        <h1 className="font-display text-[36px] tracking-[-0.025em] mb-8 leading-tight">
          Política de Privacidade
        </h1>

        <div className="prose prose-sm max-w-none text-[14px] leading-relaxed space-y-5 text-foreground">
          <p>
            Esta Política de Privacidade descreve como o <b>Finanças</b> (&ldquo;app&rdquo;,
            &ldquo;nós&rdquo;) coleta, usa, armazena, compartilha e protege seus dados pessoais,
            em conformidade com a <b>Lei Geral de Proteção de Dados — Lei nº 13.709/2018 (LGPD)</b>{" "}
            e demais legislações aplicáveis.
          </p>

          <Section title="1. Quem somos">
            <p>
              O Finanças é uma aplicação pessoal de gestão financeira para indivíduos e casais.
              Para questões de privacidade e proteção de dados, entre em contato pelo email do
              titular: <a href="mailto:marcelo.salgado.caliman@gmail.com" className="text-navy-700 dark:text-navy-300">marcelo.salgado.caliman@gmail.com</a>.
            </p>
          </Section>

          <Section title="2. Dados que coletamos">
            <p>Para funcionar, o app coleta e armazena os seguintes dados:</p>
            <ul>
              <li><b>Identificação:</b> nome, email, senha (criptografada).</li>
              <li><b>Financeiros:</b> contas bancárias cadastradas manualmente, transações (receitas/despesas), categorias, metas, investimentos, valores aplicados.</li>
              <li><b>Comportamentais:</b> data/hora de login, IP, user-agent — apenas para segurança e atendimento de pedidos LGPD.</li>
              <li><b>Técnicos:</b> preferências do app (tema, idioma, moeda de exibição).</li>
            </ul>
            <p>
              <b>NÃO coletamos:</b> credenciais de internet banking, dados de cartão de crédito,
              CPF/RG (a menos que vc digite manualmente em alguma transação), localização geográfica
              precisa, contatos da agenda, conteúdo de outros aplicativos.
            </p>
          </Section>

          <Section title="3. Finalidades do tratamento">
            <ul>
              <li>Permitir que vc gerencie suas finanças pessoais (função principal do app).</li>
              <li>Garantir segurança da conta (logs de login, autenticação).</li>
              <li>Cumprir obrigações legais (LGPD, fiscalização).</li>
              <li>Melhorar o app (análise agregada, anonimizada).</li>
            </ul>
            <p>
              Nunca usamos seus dados para perfilamento de marketing, venda a terceiros ou
              decisões automatizadas que afetem seus direitos.
            </p>
          </Section>

          <Section title="4. Bases legais (LGPD art. 7º)">
            <ul>
              <li><b>Consentimento</b> (art. 7º I): cookies opcionais, emails de marketing.</li>
              <li><b>Execução de contrato</b> (art. 7º V): funcionamento básico do app.</li>
              <li><b>Cumprimento de obrigação legal</b> (art. 7º II): audit log, retenção fiscal.</li>
              <li><b>Legítimo interesse</b> (art. 7º IX): segurança e prevenção de fraude.</li>
            </ul>
          </Section>

          <Section title="5. Com quem compartilhamos">
            <p>Compartilhamos dados apenas com:</p>
            <ul>
              <li><b>Supabase</b> (provedor de banco de dados e autenticação) — dados armazenados criptografados em servidores na União Europeia.</li>
              <li><b>Vercel</b> (provedor de hospedagem do app web).</li>
              <li><b>brapi.dev</b> (cotações de ativos) — apenas tickers públicos consultados, sem dados pessoais.</li>
              <li><b>Banco Central do Brasil</b> (taxas Selic/CDI) — apenas consultas públicas.</li>
              <li><b>Autoridades</b> mediante ordem judicial ou requisição formal de órgão competente.</li>
            </ul>
            <p>
              <b>Não vendemos seus dados.</b> Não compartilhamos com plataformas de ads, redes sociais,
              brokers de dados ou empresas de scoring.
            </p>
          </Section>

          <Section title="6. Seus direitos como titular (LGPD art. 18)">
            <ul>
              <li><b>Confirmação</b> da existência de tratamento.</li>
              <li><b>Acesso</b> aos dados que mantemos.</li>
              <li><b>Correção</b> de dados incompletos, inexatos ou desatualizados.</li>
              <li><b>Anonimização, bloqueio ou eliminação</b> de dados desnecessários ou tratados em desacordo com a lei.</li>
              <li><b>Portabilidade</b> dos dados (export em JSON).</li>
              <li><b>Eliminação</b> dos dados pessoais tratados com consentimento.</li>
              <li><b>Informação</b> sobre compartilhamento (vide seção 5).</li>
              <li><b>Informação</b> sobre não consentir e suas consequências.</li>
              <li><b>Revogação do consentimento</b> a qualquer momento.</li>
            </ul>
            <p>
              Vc exerce esses direitos diretamente em{" "}
              <Link href="/configuracoes/privacidade" className="text-navy-700 dark:text-navy-300">
                /configuracoes/privacidade
              </Link>
              . Atendimento em até 15 dias.
            </p>
          </Section>

          <Section title="7. Retenção e eliminação">
            <p>
              Mantemos seus dados enquanto sua conta estiver ativa. Após pedido de eliminação:
            </p>
            <ul>
              <li>Dados pessoais identificáveis: apagados em até 15 dias.</li>
              <li>Dados anonimizados (para análise agregada): podem ser mantidos.</li>
              <li>Logs de auditoria de ações administrativas: 5 anos (cumprimento legal).</li>
              <li>Backups: removidos no próximo ciclo (até 30 dias).</li>
            </ul>
          </Section>

          <Section title="8. Segurança">
            <p>
              Aplicamos medidas técnicas e organizacionais para proteger seus dados:
              criptografia em trânsito (TLS), criptografia em repouso (Supabase),
              senhas armazenadas com bcrypt, segregação de acesso por household via RLS,
              audit log imutável de ações administrativas.
            </p>
            <p>
              <b>Em caso de incidente de segurança</b> que afete seus dados, notificaremos vc
              e a ANPD em até 72 horas, conforme exigido pela LGPD art. 48.
            </p>
          </Section>

          <Section title="9. Cookies">
            <p>
              Usamos cookies estritamente necessários (sessão de autenticação) sempre.
              Cookies opcionais (analytics) só com seu consentimento prévio, que vc pode
              revogar a qualquer momento.
            </p>
          </Section>

          <Section title="10. Crianças e adolescentes">
            <p>
              O app não é destinado a menores de 18 anos. Não coletamos dados de menores
              intencionalmente. Se vc é responsável e descobriu que seu filho criou conta,
              entre em contato pra eliminação imediata.
            </p>
          </Section>

          <Section title="11. Transferência internacional">
            <p>
              Seus dados são armazenados em servidores Supabase localizados na União Europeia,
              região que oferece nível adequado de proteção conforme avaliação da ANPD.
            </p>
          </Section>

          <Section title="12. Alterações">
            <p>
              Esta Política pode ser atualizada. Mudanças relevantes geram nova versão e
              vc será notificado no próximo login pra re-aceitar. Vc pode consultar
              versões anteriores mediante solicitação.
            </p>
          </Section>

          <Section title="13. Contato e ANPD">
            <p>
              Encarregado pelo Tratamento de Dados (DPO): a definir formalmente quando o app
              virar SaaS comercial. Até lá: <a href="mailto:marcelo.salgado.caliman@gmail.com" className="text-navy-700 dark:text-navy-300">marcelo.salgado.caliman@gmail.com</a>.
            </p>
            <p>
              Vc pode também recorrer à <b>Autoridade Nacional de Proteção de Dados (ANPD)</b>:{" "}
              <a href="https://www.gov.br/anpd" target="_blank" rel="noopener" className="text-navy-700 dark:text-navy-300">www.gov.br/anpd</a>.
            </p>
          </Section>

          <div className="border-t border-border pt-6 mt-10">
            <p className="text-[12.5px] text-faint-foreground italic">
              Esta política é uma versão inicial elaborada de boa fé. Antes de operar como
              SaaS comercial em escala, recomenda-se revisão por advogado especialista em
              proteção de dados.
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
      <div className="space-y-2 text-[14px] leading-relaxed">{children}</div>
    </section>
  );
}
