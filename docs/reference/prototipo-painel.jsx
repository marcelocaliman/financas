import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from 'recharts';
import { LayoutDashboard, Wallet, TrendingUp, PiggyBank, LineChart, Target, BarChart3, Settings, ArrowUpRight, ArrowLeftRight } from 'lucide-react';

const C = {
  navy: '#243B53',
  text: '#243B53',
  muted: '#6B7C93',
  faint: '#90A0B3',
  teal: '#2C7A7B',
  tealSoft: '#E6F2F2',
  eur: '#5B7B9A',
  eurSoft: '#EAF0F5',
  bg: '#F5F8FA',
  card: '#FFFFFF',
  border: '#E6ECF1',
  pos: '#2C7A7B',
};

const RATE = 5.97; // 1 EUR = 5.97 BRL — âncora de planejamento (editável no app real)

function convert(amount, from, to) {
  if (from === to) return amount;
  if (from === 'BRL' && to === 'EUR') return amount / RATE;
  if (from === 'EUR' && to === 'BRL') return amount * RATE;
  return amount;
}

const assets = [
  { name: 'Tesouro Direto', cur: 'BRL', amount: 320000 },
  { name: 'CDB', cur: 'BRL', amount: 180000 },
  { name: 'LCI/LCA', cur: 'BRL', amount: 95000 },
  { name: 'Imóvel (aluguel · RJ)', cur: 'BRL', amount: 850000 },
  { name: 'Conta corrente · Itália', cur: 'EUR', amount: 12000 },
  { name: 'Reserva', cur: 'EUR', amount: 25000 },
];

const expenses = [
  { name: 'Moradia', cur: 'EUR', amount: 600 },
  { name: 'Alimentação', cur: 'EUR', amount: 450 },
  { name: 'Lazer', cur: 'EUR', amount: 200 },
  { name: 'Outros', cur: 'EUR', amount: 150 },
  { name: 'Transporte', cur: 'EUR', amount: 120 },
  { name: 'Saúde', cur: 'EUR', amount: 90 },
];

const incomes = [
  { name: 'Freela', cur: 'EUR', amount: 3500 },
  { name: 'Aluguel · RJ', cur: 'BRL', amount: 4200 },
];

const trendEUR = [
  { m: 'Jan', v: 262000 },
  { m: 'Fev', v: 268000 },
  { m: 'Mar', v: 271500 },
  { m: 'Abr', v: 274000 },
  { m: 'Mai', v: 277200 },
  { m: 'Jun', v: 279043 },
];

const catColors = ['#2C7A7B', '#5B7B9A', '#7FB2B2', '#9FB3C8', '#C5D2DD', '#E2E8EE'];

export default function App() {
  const [disp, setDisp] = useState('EUR');

  const fmt = (val, opts = {}) => {
    const loc = disp === 'BRL' ? 'pt-BR' : 'it-IT';
    return new Intl.NumberFormat(loc, { style: 'currency', currency: disp, maximumFractionDigits: 0, ...opts }).format(val);
  };

  const assetsDisp = assets.map(a => ({ ...a, disp: convert(a.amount, a.cur, disp) }));
  const totalNW = assetsDisp.reduce((s, a) => s + a.disp, 0);
  const brlOrigin = assets.filter(a => a.cur === 'BRL').reduce((s, a) => s + convert(a.amount, 'BRL', disp), 0);
  const brlPct = Math.round((brlOrigin / totalNW) * 100);
  const eurPct = 100 - brlPct;

  const expDisp = expenses.map(e => ({ ...e, value: convert(e.amount, e.cur, disp) }));
  const totalExp = expDisp.reduce((s, e) => s + e.value, 0);
  const totalInc = incomes.reduce((s, e) => s + convert(e.amount, e.cur, disp), 0);
  const saldoMes = totalInc - totalExp;

  const trend = trendEUR.map(t => ({ m: t.m, v: convert(t.v, 'EUR', disp) }));
  const nwChange = ((trendEUR[5].v - trendEUR[4].v) / trendEUR[4].v) * 100;

  const nav = [
    { icon: LayoutDashboard, label: 'Painel', active: true },
    { icon: Wallet, label: 'Patrimônio' },
    { icon: TrendingUp, label: 'Investimentos' },
    { icon: PiggyBank, label: 'Orçamento' },
    { icon: LineChart, label: 'Histórico' },
    { icon: Target, label: 'Objetivos' },
    { icon: BarChart3, label: 'Projeção' },
    { icon: Settings, label: 'Config' },
  ];

  const font = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: font, minHeight: '100vh' }} className="w-full">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`}</style>
      <div className="flex">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:flex md:flex-col md:w-60 md:min-h-screen px-4 py-6" style={{ background: C.card, borderRight: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 px-2 mb-8">
            <div style={{ background: C.teal, width: 30, height: 30, borderRadius: 9 }} className="flex items-center justify-center">
              <ArrowLeftRight size={16} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>dual</span>
            <span style={{ fontSize: 10, color: C.faint, marginTop: 2 }}>(nome a definir)</span>
          </div>
          <nav className="flex flex-col gap-1">
            {nav.map((n, i) => {
              const Icon = n.icon;
              return (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: n.active ? C.tealSoft : 'transparent', color: n.active ? C.teal : C.muted, fontWeight: n.active ? 600 : 500, fontSize: 14, cursor: 'pointer' }}>
                  <Icon size={18} />
                  <span>{n.label}</span>
                </div>
              );
            })}
          </nav>
          <div className="mt-auto px-3 py-3 rounded-lg" style={{ background: C.bg, fontSize: 12, color: C.faint }}>
            Protótipo · dados de exemplo
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-h-screen pb-24 md:pb-8">
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 md:px-8 py-5" style={{ borderBottom: `1px solid ${C.border}`, background: C.card }}>
            <div>
              <div style={{ fontSize: 12, color: C.faint, fontWeight: 600, letterSpacing: '0.04em' }} className="uppercase">Painel</div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>Olá, Marcelo</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right" style={{ fontSize: 11, color: C.faint, lineHeight: 1.3 }}>
                <div>câmbio</div>
                <div style={{ color: C.muted, fontWeight: 600 }} className="tabular-nums">1 € = R$ 5,97</div>
              </div>
              <div className="flex p-1 rounded-xl" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                {['BRL', 'EUR'].map(c => (
                  <button key={c} onClick={() => setDisp(c)} className="px-3 py-1 rounded-lg" style={{ fontSize: 13, fontWeight: 600, transition: 'all .15s', background: disp === c ? C.teal : 'transparent', color: disp === c ? '#fff' : C.muted, cursor: 'pointer', border: 'none' }}>
                    {c === 'BRL' ? 'R$' : '€'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-5 md:px-8 py-6 space-y-5" style={{ maxWidth: 1080 }}>
            {/* Hero: net worth + currency split */}
            <div className="rounded-2xl p-6 md:p-7" style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 1px 2px rgba(36,59,83,0.04)' }}>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>Patrimônio líquido</div>
                  <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 4 }} className="tabular-nums">{fmt(totalNW)}</div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: C.tealSoft, color: C.teal, fontSize: 13, fontWeight: 600 }}>
                  <ArrowUpRight size={15} />
                  <span className="tabular-nums">+{nwChange.toFixed(1)}% no mês</span>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex rounded-full overflow-hidden" style={{ height: 10, background: C.border }}>
                  <div style={{ width: `${brlPct}%`, background: C.teal }} />
                  <div style={{ width: `${eurPct}%`, background: C.eur }} />
                </div>
                <div className="flex items-center gap-5 mt-3" style={{ fontSize: 13 }}>
                  <div className="flex items-center gap-2">
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: C.teal }} />
                    <span style={{ color: C.muted }}>Real (BRL)</span>
                    <span style={{ fontWeight: 600 }} className="tabular-nums">{brlPct}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: C.eur }} />
                    <span style={{ color: C.muted }}>Euro (EUR)</span>
                    <span style={{ fontWeight: 600 }} className="tabular-nums">{eurPct}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Stat label="Ativos" value={fmt(totalNW)} sub="6 posições" C={C} />
              <Stat label="Investido" value={fmt(convert(595000, 'BRL', disp))} sub="Renda fixa" C={C} />
              <Stat label="Receitas · mês" value={fmt(totalInc)} sub="2 fontes" C={C} pos />
              <Stat label="Saldo · mês" value={fmt(saldoMes)} sub="Junho" C={C} pos={saldoMes >= 0} />
            </div>

            {/* two columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Budget */}
              <div className="rounded-2xl p-6" style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 1px 2px rgba(36,59,83,0.04)' }}>
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontWeight: 600, fontSize: 15 }}>Orçamento · Junho</span>
                  <span style={{ fontSize: 13, color: C.muted }} className="tabular-nums">{fmt(totalExp)}</span>
                </div>
                <div style={{ fontSize: 12, color: C.faint, marginBottom: 8 }}>Gastos por categoria</div>
                <div className="flex items-center gap-4">
                  <div style={{ width: 130, height: 130 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={expDisp} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={2} stroke="none">
                          {expDisp.map((e, i) => <Cell key={i} fill={catColors[i % catColors.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => fmt(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {expDisp.map((e, i) => (
                      <div key={i} className="flex items-center justify-between" style={{ fontSize: 13 }}>
                        <span className="flex items-center gap-2" style={{ color: C.muted }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: catColors[i % catColors.length] }} />
                          {e.name}
                        </span>
                        <span style={{ fontWeight: 500 }} className="tabular-nums">{fmt(e.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Net worth trend */}
              <div className="rounded-2xl p-6" style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 1px 2px rgba(36,59,83,0.04)' }}>
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontWeight: 600, fontSize: 15 }}>Evolução do patrimônio</span>
                  <span style={{ fontSize: 13, color: C.teal, fontWeight: 600 }} className="tabular-nums">+{nwChange.toFixed(1)}%</span>
                </div>
                <div style={{ fontSize: 12, color: C.faint, marginBottom: 12 }}>Últimos 6 meses · {disp === 'BRL' ? 'R$' : '€'}</div>
                <div style={{ width: '100%', height: 150 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                      <defs>
                        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.teal} stopOpacity={0.25} />
                          <stop offset="100%" stopColor={C.teal} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="m" tick={{ fontSize: 11, fill: C.faint }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => fmt(v)} />
                      <Area type="monotone" dataKey="v" stroke={C.teal} strokeWidth={2.5} fill="url(#g)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* assets list */}
            <div className="rounded-2xl p-6" style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 1px 2px rgba(36,59,83,0.04)' }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Posições</div>
              <div>
                {assetsDisp.map((a, i) => (
                  <div key={i} className="flex items-center justify-between py-2" style={{ borderBottom: i < assetsDisp.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <div className="flex items-center gap-3">
                      <span className="px-1.5 py-0.5 rounded" style={{ fontSize: 11, fontWeight: 700, background: a.cur === 'BRL' ? C.tealSoft : C.eurSoft, color: a.cur === 'BRL' ? C.teal : C.eur }}>
                        {a.cur === 'BRL' ? 'R$' : '€'}
                      </span>
                      <span style={{ fontSize: 14 }}>{a.name}</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600 }} className="tabular-nums">{fmt(a.disp)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* bottom nav (mobile) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 flex items-center justify-around px-2 py-2" style={{ background: C.card, borderTop: `1px solid ${C.border}` }}>
        {nav.slice(0, 5).map((n, i) => {
          const Icon = n.icon;
          return (
            <div key={i} className="flex flex-col items-center gap-0.5 px-2 py-1" style={{ color: n.active ? C.teal : C.faint }}>
              <Icon size={20} />
              <span style={{ fontSize: 10, fontWeight: n.active ? 600 : 500 }}>{n.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, C, pos }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 1px 2px rgba(36,59,83,0.04)' }}>
      <div style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', marginTop: 4, color: pos ? C.pos : C.navy }} className="tabular-nums">{value}</div>
      <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>{sub}</div>
    </div>
  );
}
