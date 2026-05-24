"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import type { RendimentosReport, RendimentoRow } from "@/services/ir/rendimentos";

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

export function RendimentosTabs({
  rendimentos,
  year,
}: {
  rendimentos: RendimentosReport;
  year: number;
}) {
  const [tab, setTab] = useState<"tributaveis" | "isentos" | "exclusivos">("tributaveis");

  const tabs = [
    {
      key: "tributaveis" as const,
      label: "Tributáveis (PJ/PF)",
      total: rendimentos.tributaveis.total,
      count: rendimentos.tributaveis.rows.length,
    },
    {
      key: "isentos" as const,
      label: "Isentos",
      total: rendimentos.isentos.total,
      count: rendimentos.isentos.rows.length,
    },
    {
      key: "exclusivos" as const,
      label: "Exclusivos na fonte",
      total: rendimentos.exclusivos.total,
      count: rendimentos.exclusivos.rows.length,
    },
  ];

  const active =
    tab === "tributaveis"
      ? rendimentos.tributaveis.rows
      : tab === "isentos"
        ? rendimentos.isentos.rows
        : rendimentos.exclusivos.rows;

  return (
    <div>
      <div className="flex border-b border-border mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2.5 text-[12.5px] border-b-2 -mb-px transition-colors",
              tab === t.key
                ? "border-navy-700 text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}{" "}
            <span className="font-mono text-faint-foreground text-[11px] ml-1">
              · R$ {fmtBRL(t.total)} ({t.count})
            </span>
          </button>
        ))}
      </div>

      {tab === "tributaveis" && (
        <TributaveisView rendimentos={rendimentos} year={year} />
      )}
      {tab === "isentos" && <IsentosView rendimentos={rendimentos} />}
      {tab === "exclusivos" && <ExclusivosView rendimentos={rendimentos} />}
    </div>
  );
}

function TributaveisView({
  rendimentos,
  year,
}: {
  rendimentos: RendimentosReport;
  year: number;
}) {
  const { rows, total, totalIrrf, totalInss, total13 } = rendimentos.tributaveis;
  if (rows.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground italic py-4">
        Nenhum rendimento tributável detectado. Salários, pró-labore e aluguel
        recebido entram aqui — confira se as transações estão na categoria certa
        ou cadastre manualmente em <code>Configurações → Outras rendas</code>.
      </p>
    );
  }
  return (
    <div>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-faint-foreground font-mono text-[10.5px] uppercase tracking-[0.12em]">
            <th className="text-left pb-2 pr-3 font-medium">Fonte pagadora</th>
            <th className="text-left pb-2 pr-3 font-medium">CNPJ/CPF</th>
            <th className="text-right pb-2 pr-3 font-medium">Rendimento</th>
            <th className="text-right pb-2 pr-3 font-medium">INSS</th>
            <th className="text-right pb-2 pr-3 font-medium">IRRF</th>
            <th className="text-right pb-2 font-medium">13º</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <RendimentoLine key={i} r={r} />
          ))}
          <tr className="border-t-2 border-border-strong">
            <td colSpan={2} className="pt-2.5 pr-3 font-mono text-[11px] uppercase tracking-[0.12em] text-faint-foreground font-medium">
              Total
            </td>
            <td className="pt-2.5 pr-3 font-mono text-right tabular-nums text-foreground font-medium">R$ {fmtBRL(total)}</td>
            <td className="pt-2.5 pr-3 font-mono text-right tabular-nums">R$ {fmtBRL(totalInss)}</td>
            <td className="pt-2.5 pr-3 font-mono text-right tabular-nums">R$ {fmtBRL(totalIrrf)}</td>
            <td className="pt-2.5 font-mono text-right tabular-nums">R$ {fmtBRL(total13)}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-[11.5px] text-faint-foreground mt-3">
        Esses valores entram em "Rendimentos Tributáveis Recebidos de PJ/PF" no
        programa IRPF/{year + 1}.
      </p>
    </div>
  );
}

function IsentosView({ rendimentos }: { rendimentos: RendimentosReport }) {
  const { rows, total, dividends, lciLca, fiiRendimentos, other } = rendimentos.isentos;
  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 text-[12px]">
        <Stat label="Dividendos" value={dividends} code="09" />
        <Stat label="LCI/LCA/CRI/CRA" value={lciLca} code="12" />
        <Stat label="Rendimentos FII" value={fiiRendimentos} code="26" />
        <Stat label="Outros isentos" value={other} code="99" />
      </div>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-faint-foreground font-mono text-[10.5px] uppercase tracking-[0.12em]">
            <th className="text-left pb-2 pr-3 font-medium">Cod</th>
            <th className="text-left pb-2 pr-3 font-medium">Descrição / Fonte</th>
            <th className="text-left pb-2 pr-3 font-medium">CNPJ/CPF</th>
            <th className="text-right pb-2 font-medium">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border align-top">
              <td className="py-2 pr-3 font-mono text-foreground">{r.receitaCode ?? "—"}</td>
              <td className="py-2 pr-3">
                <div className="text-foreground">{r.description}</div>
                <div className="text-faint-foreground text-[11px] mt-0.5">{r.payerName}</div>
              </td>
              <td className="py-2 pr-3 font-mono text-faint-foreground text-[11.5px]">{r.payerCnpjCpf ?? "—"}</td>
              <td className="py-2 font-mono text-right tabular-nums">R$ {fmtBRL(r.grossAmount)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-border-strong">
            <td colSpan={3} className="pt-2.5 pr-3 font-mono text-[11px] uppercase tracking-[0.12em] text-faint-foreground font-medium">
              Total
            </td>
            <td className="pt-2.5 font-mono text-right tabular-nums text-foreground font-medium">R$ {fmtBRL(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ExclusivosView({ rendimentos }: { rendimentos: RendimentosReport }) {
  const { rows, total, rendaFixa, jcp, thirteenth, other } = rendimentos.exclusivos;
  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 text-[12px]">
        <Stat label="Aplicações financeiras" value={rendaFixa} code="06" />
        <Stat label="JCP" value={jcp} code="10" />
        <Stat label="13º salário" value={thirteenth} code="01" />
        <Stat label="Outros" value={other} code="99" />
      </div>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-faint-foreground font-mono text-[10.5px] uppercase tracking-[0.12em]">
            <th className="text-left pb-2 pr-3 font-medium">Cod</th>
            <th className="text-left pb-2 pr-3 font-medium">Descrição / Fonte</th>
            <th className="text-left pb-2 pr-3 font-medium">CNPJ/CPF</th>
            <th className="text-right pb-2 pr-3 font-medium">Bruto</th>
            <th className="text-right pb-2 font-medium">IRRF</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border align-top">
              <td className="py-2 pr-3 font-mono text-foreground">{r.receitaCode ?? "—"}</td>
              <td className="py-2 pr-3">
                <div className="text-foreground">{r.description}</div>
                <div className="text-faint-foreground text-[11px] mt-0.5">{r.payerName}</div>
              </td>
              <td className="py-2 pr-3 font-mono text-faint-foreground text-[11.5px]">{r.payerCnpjCpf ?? "—"}</td>
              <td className="py-2 pr-3 font-mono text-right tabular-nums">R$ {fmtBRL(r.grossAmount)}</td>
              <td className="py-2 font-mono text-right tabular-nums text-faint-foreground">R$ {fmtBRL(r.irrf)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-border-strong">
            <td colSpan={3} className="pt-2.5 pr-3 font-mono text-[11px] uppercase tracking-[0.12em] text-faint-foreground font-medium">
              Total
            </td>
            <td className="pt-2.5 pr-3 font-mono text-right tabular-nums text-foreground font-medium">R$ {fmtBRL(total)}</td>
            <td className="pt-2.5 font-mono text-right tabular-nums">—</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function RendimentoLine({ r }: { r: RendimentoRow }) {
  return (
    <tr className="border-t border-border align-top">
      <td className="py-2 pr-3 text-foreground">{r.payerName}</td>
      <td className="py-2 pr-3 font-mono text-faint-foreground text-[11.5px]">{r.payerCnpjCpf ?? "—"}</td>
      <td className="py-2 pr-3 font-mono text-right tabular-nums text-foreground">R$ {fmtBRL(r.grossAmount)}</td>
      <td className="py-2 pr-3 font-mono text-right tabular-nums text-faint-foreground">R$ {fmtBRL(r.inss)}</td>
      <td className="py-2 pr-3 font-mono text-right tabular-nums text-faint-foreground">R$ {fmtBRL(r.irrf)}</td>
      <td className="py-2 font-mono text-right tabular-nums text-faint-foreground">R$ {fmtBRL(r.thirteenth)}</td>
    </tr>
  );
}

function Stat({ label, value, code }: { label: string; value: number; code: string }) {
  return (
    <div className="rounded-[8px] border border-border bg-surface px-3 py-2.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint-foreground font-medium flex items-center justify-between">
        <span>{label}</span>
        <span className="text-navy-700 dark:text-navy-300">cod {code}</span>
      </div>
      <div className="font-mono text-[15px] tabular-nums mt-1">R$ {fmtBRL(value)}</div>
    </div>
  );
}
