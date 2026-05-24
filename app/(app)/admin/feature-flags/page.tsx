import { ToggleRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { listFeatureFlags } from "@/services/feature-flags";
import { FeatureFlagsList } from "@/components/admin/feature-flags-list";
import { NewFeatureFlagForm } from "@/components/admin/new-feature-flag-form";

export const dynamic = "force-dynamic";

export default async function AdminFeatureFlagsPage() {
  const flags = await listFeatureFlags();

  return (
    <>
      <PageHeader
        eyebrow={`${flags.length} flags · ${flags.filter((f) => f.enabled).length} ligadas`}
        title={
          <>
            <span className="inline-flex items-center gap-2">
              <ToggleRight className="w-7 h-7 text-navy-700 dark:text-navy-300" strokeWidth={1.5} />
              Feature <em className="not-italic font-display italic text-navy-700 dark:text-navy-300">flags</em>
            </span>
          </>
        }
        subtitle="Liga/desliga features no app sem deploy. Suporta gating por plano (Pro, Family, etc) e rollout gradual (X% dos households)."
      />

      <FeatureFlagsList flags={flags} />

      <Panel className="mt-6">
        <NewFeatureFlagForm />
      </Panel>

      <Panel className="mt-6 border-navy-700/30">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-navy-700 dark:text-navy-300 font-medium mb-2">
          Como usar no código
        </div>
        <pre className="text-[12px] bg-bone-100 dark:bg-ink-800 rounded-[8px] p-3 overflow-x-auto font-mono">
{`import { isFeatureEnabled } from "@/services/feature-flags";

const showAiInsights = await isFeatureEnabled("investments_ai_insights");
if (showAiInsights) {
  // renderiza o componente
}`}
        </pre>
        <p className="text-[12px] text-muted-foreground mt-3 leading-relaxed">
          <code>isFeatureEnabled</code> é cached por request (chama múltiplas vezes
          custa só 1 query). Considera <code>enabled</code>, <code>enabled_for_tiers</code>{" "}
          e <code>rollout_pct</code> (hash determinístico do household_id).
        </p>
      </Panel>
    </>
  );
}
