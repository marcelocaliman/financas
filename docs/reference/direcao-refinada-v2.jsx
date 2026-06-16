import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts';
import { ArrowLeftRight, Eye, ArrowUpRight, ChevronDown } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// DIREÇÃO VISUAL DEFINITIVA — APROVADA. É a referência do re-skin do app:
// near-black NEUTRO (#0A0B0D, sem azul/navy) + verde refinado #3ECF8E,
// Inter em tudo (sem serifada), micro-labels em JetBrains Mono, full-width.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg: '#0A0B0D',
  surface: '#131418',
  surface2: '#191B20',
  border: 'rgba(255,255,255,0.08)',
  text: '#F3F4F6',
  text2: '#9CA2AC',
  faint: '#5F646C',
  accent: '#3ECF8E',
  accentDim: '#2C9E6C',
  eur: '#8A8F98',
  neg: '#F1746A',
};

const RATE = 5.97;
const conv = (a, f, t) => (f === t ? a : f === 'BRL' ? a / RATE : a * RATE);

const assets = [
  { name: 'Tesouro Direto', tipo: 'Investimento', cur: 'BRL', amount: 320000 },
  { name: 'CDB', tipo: 'Investimento', cur: 'BRL', amount: 180000 },
  { name: 'LCI/LCA', tipo: 'Investimento', cur: 'BRL', amount: 95000 },
  { name: 'Imóvel (aluguel · RJ)', tipo: 'Imóvel', cur: 'BRL', amount: 850000 },
  { name: 'Conta corrente · Itália', tipo: 'Caixa', cur: 'EUR', amount: 12000 },
  { name: 'Reserva', tipo: 'Caixa', cur: 'EUR', amount: 25000 },
];
const expenses = [
  { name: 'Moradia', cur: 'EUR', amount: 600 }, { name: 'Alimentação', cur: 'EUR', amount: 450 },
  { name: 'Lazer', cur: 'EUR', amount: 200 }, { name: 'Outros', cur: 'EUR', amount: 150 },
  { name: 'Transporte', cur: 'EUR', amount: 120 }, { name: 'Saúde', cur: 'EUR', amount: 90 },
];
const incomes = [{ cur: 'EUR', amount: 3500 }, { cur: 'BRL', amount: 4200 }];
const trendEUR = [262000, 268000, 271500, 274000, 277200, 279043].map((v, i) => ({ m: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'][i], v }));
const catColors = ['#3ECF8E', '#2E9E73', '#6B7280', '#878E98', '#A6ACB5', '#3A4046'];

export default function App() {
  const [disp, setDisp] = useState('BRL');
  const fmt = (v, d = 0) => new Intl.NumberFormat(disp === 'BRL' ? 'pt-BR' : 'it-IT', { style: 'currency', currency: disp, maximumFractionDigits: d }).format(v);

  const nw = assets.reduce((s, a) => s + conv(a.amount, a.cur, disp), 0);
  const brl = assets.filter(a => a.cur === 'BRL').reduce((s, a) => s + conv(a.amount, 'BRL', disp), 0);
  const brlPct = Math.round((brl / nw) * 100), eurPct = 100 - brlPct;
  const exp = expenses.map(e => ({ ...e, value: conv(e.amount, e.cur, disp) }));
  const totalExp = exp.reduce((s, e) => s + e.value, 0);
  const inc = incomes.reduce((s, e) => s + conv(e.amount, e.cur, disp), 0);
  const trend = trendEUR.map(t => ({ m: t.m, v: conv(t.v, 'EUR', disp) }));

  const nav = ['Painel', 'Patrimônio', 'Investimentos', 'Orçamento', 'Histórico', 'Objetivos', 'Projeção', 'Config'];
  const sans = "Inter, system-ui, -apple-system, sans-serif";
  const mono = "'JetBrains Mono', ui-monospace, monospace";
  const label = { fontFamily: mono, fontSize: 10.5, letterSpacing: '0.12em', color: C.faint, textTransform: 'uppercase', fontWeight: 500 };
  const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16 };

  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: sans, minHeight: '100vh', width: '100%' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');`}</style>

      {/* Header — full width, no clipping */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(10,11,13,0.82)', borderBottom: `1px solid ${C.border}` }} className="backdrop-blur w-full">
        <div className="flex items-center justify-between px-5 md:px-10 lg:px-14" style={{ height: 60 }}>
          <div className="flex items-center gap-7">
            <div className="flex items-center gap-2">
              <div style={{ background: C.accent, width: 26, height: 26, borderRadius: 7 }} className="flex items-center justify-center">
                <ArrowLeftRight size={14} color="#0A0B0D" strokeWidth={2.6} />
              </div>
              <span style={{ fontWeight: 700, fontSize: 15.5, letterSpacing: '-0.02em' }}>Finanças</span>
            </div>
            <nav className="hidden lg:flex items-center gap-5">
              {nav.map((n, i) => <span key={i} style={{ fontSize: 13, fontWeight: i === 0 ? 600 : 500, color: i === 0 ? C.accent : C.text2, cursor: 'pointer' }}>{n}</span>)}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Eye size={16} color={C.faint} className="hidden sm:block" />
            <div className="hidden sm:flex items-center rounded-lg" style={{ background: C.surface2, border: `1px solid ${C.border}`, padding: 2 }}>
              {['R$', '€', 'US$', '£'].map((c, i) => (
                <span key={c} onClick={() => i < 2 && setDisp(i === 0 ? 'BRL' : 'EUR')} className="px-2 py-1 rounded-md" style={{ fontSize: 12, fontWeight: 600, color: (disp === 'BRL' && i === 0) || (disp === 'EUR' && i === 1) ? '#0A0B0D' : C.text2, background: (disp === 'BRL' && i === 0) || (disp === 'EUR' && i === 1) ? C.accent : 'transparent', cursor: 'pointer' }}>{c}</span>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-lg pl-1 pr-2 py-1" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
              <div style={{ width: 22, height: 22, borderRadius: 999, background: C.accent, color: '#0A0B0D', fontSize: 11, fontWeight: 700 }} className="flex items-center justify-center">M</div>
              <span style={{ fontSize: 13, fontWeight: 500 }} className="hidden sm:block">Marcelo</span>
              <ChevronDown size={14} color={C.text2} />
            </div>
          </div>
        </div>
      </header>

      {/* HERO — full width, distinct, impactful */}
      <section style={{ position: 'relative', overflow: 'hidden' }} className="w-full px-5 md:px-10 lg:px-14">
        <div style={{ position: 'absolute', top: -120, left: '20%', width: 700, height: 400, background: 'radial-gradient(ellipse, rgba(62,207,142,0.14), transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', paddingTop: 72, paddingBottom: 56 }}>
          <div style={{ ...label, color: C.accent, marginBottom: 18 }}>Patrimônio · atualizado hoje</div>
          <h1 style={{ fontSize: 'clamp(2.4rem, 5vw, 3.6rem)', fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1.02, maxWidth: 760 }}>
            Constância vence o mercado.
          </h1>
          <div className="flex flex-wrap items-end gap-x-14 gap-y-6" style={{ marginTop: 44 }}>
            <div>
              <div style={{ ...label, marginBottom: 10 }}>Patrimônio líquido</div>
              <div style={{ fontSize: 'clamp(3rem, 6.5vw, 4.8rem)', fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{fmt(nw)}</div>
              <div className="flex items-center gap-1.5" style={{ marginTop: 14, color: C.accent, fontSize: 14, fontWeight: 600 }}>
                <ArrowUpRight size={16} /><span className="tabular-nums">+0,7%</span><span style={{ color: C.faint, fontWeight: 500 }}>vs. mês anterior</span>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 280, maxWidth: 460 }}>
              <div style={{ ...label, marginBottom: 12 }}>Composição</div>
              <div className="flex rounded-full overflow-hidden" style={{ height: 8, background: C.surface2 }}>
                <div style={{ width: `${brlPct}%`, background: C.accent }} /><div style={{ width: `${eurPct}%`, background: C.eur }} />
              </div>
              <div className="flex items-center gap-6 tabular-nums" style={{ marginTop: 14, fontSize: 13 }}>
                <span className="flex items-center gap-2" style={{ color: C.text2 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: C.accent }} />Real <b style={{ color: C.text, fontWeight: 600, marginLeft: 2 }}>{brlPct}%</b></span>
                <span className="flex items-center gap-2" style={{ color: C.text2 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: C.eur }} />Euro <b style={{ color: C.text, fontWeight: 600, marginLeft: 2 }}>{eurPct}%</b></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div style={{ height: 1, background: C.border }} className="w-full" />

      {/* DASHBOARD — full width grid */}
      <section className="w-full px-5 md:px-10 lg:px-14" style={{ paddingTop: 36, paddingBottom: 36 }}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 p-6" style={card}>
            <div className="flex items-center justify-between mb-5">
              <span style={label}>Evolução do patrimônio · 6 meses</span>
              <span style={{ color: C.accent, fontSize: 13, fontWeight: 600 }} className="tabular-nums">+0,7%</span>
            </div>
            <div style={{ width: '100%', height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
                  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity={0.22} /><stop offset="100%" stopColor={C.accent} stopOpacity={0} /></linearGradient></defs>
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: C.text2 }} />
                  <Area type="monotone" dataKey="v" stroke={C.accent} strokeWidth={2} fill="url(#g)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Stat l="Ativos" v={fmt(nw)} s="6 posições" C={C} label={label} card={card} />
            <Stat l="Investido" v={fmt(conv(595000, 'BRL', disp))} s="Renda fixa" C={C} label={label} card={card} />
            <Stat l="Receitas · mês" v={fmt(inc)} s="2 fontes" C={C} label={label} card={card} accent />
            <Stat l="Saldo · mês" v={fmt(inc - totalExp)} s="Junho" C={C} label={label} card={card} accent />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginTop: 16 }}>
          <div className="p-6" style={card}>
            <div className="flex items-center justify-between mb-4"><span style={label}>Orçamento · Junho</span><span style={{ fontSize: 13, color: C.text2 }} className="tabular-nums">{fmt(totalExp)}</span></div>
            <div className="flex items-center gap-4">
              <div style={{ width: 116, height: 116 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={exp} dataKey="value" innerRadius={36} outerRadius={56} paddingAngle={2} stroke="none">{exp.map((e, i) => <Cell key={i} fill={catColors[i]} />)}</Pie><Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} /></PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5">
                {exp.map((e, i) => <div key={i} className="flex items-center justify-between" style={{ fontSize: 12.5 }}><span className="flex items-center gap-2" style={{ color: C.text2 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: catColors[i] }} />{e.name}</span><span className="tabular-nums" style={{ fontWeight: 500 }}>{fmt(e.value)}</span></div>)}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 p-6" style={card}>
            <div className="flex items-center justify-between mb-4"><span style={label}>Posições</span><span style={{ ...label }}>6 itens</span></div>
            <div className="grid" style={{ ...label, gridTemplateColumns: '1.6fr 1fr 1fr', paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}><span>Nome</span><span>Tipo</span><span style={{ textAlign: 'right' }}>Valor</span></div>
            {assets.map((a, i) => (
              <div key={i} className="grid items-center" style={{ gridTemplateColumns: '1.6fr 1fr 1fr', padding: '11px 0', borderBottom: i < assets.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <span className="flex items-center gap-2.5"><span style={{ fontFamily: mono, fontSize: 9.5, fontWeight: 500, padding: '2px 5px', borderRadius: 4, background: a.cur === 'BRL' ? 'rgba(62,207,142,0.12)' : 'rgba(255,255,255,0.06)', color: a.cur === 'BRL' ? C.accent : C.eur }}>{a.cur === 'BRL' ? 'BRL' : 'EUR'}</span><span style={{ fontSize: 13.5 }}>{a.name}</span></span>
                <span style={{ fontSize: 13, color: C.text2 }}>{a.tipo}</span>
                <span className="tabular-nums" style={{ fontSize: 13.5, fontWeight: 600, textAlign: 'right' }}>{fmt(conv(a.amount, a.cur, disp))}</span>
              </div>
            ))}
          </div>
        </div>

        {/* upcoming — compact, not empty voids */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" style={{ marginTop: 16 }}>
          {['Investimentos', 'Histórico', 'Objetivos', 'Projeção'].map((m, i) => (
            <div key={i} className="p-5" style={{ ...card, background: 'transparent', borderStyle: 'dashed' }}>
              <div style={label}>{m}</div>
              <div style={{ fontSize: 12.5, color: C.faint, marginTop: 8 }}>Em breve</div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ height: 1, background: C.border }} className="w-full" />
      <footer className="w-full px-5 md:px-10 lg:px-14 flex flex-wrap items-center justify-between gap-3" style={{ paddingTop: 24, paddingBottom: 24 }}>
        <span style={{ fontSize: 12.5, color: C.faint }}>© 2026 Finanças · multimoeda & privado</span>
        <span style={{ ...label }}>Cifrado de ponta a ponta</span>
      </footer>
    </div>
  );
}

function Stat({ l, v, s, C, label, card, accent }) {
  return (
    <div className="p-5" style={card}>
      <div style={label}>{l}</div>
      <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 8, color: accent ? C.accent : C.text }}>{v}</div>
      <div style={{ fontSize: 11.5, color: C.faint, marginTop: 3 }}>{s}</div>
    </div>
  );
}
