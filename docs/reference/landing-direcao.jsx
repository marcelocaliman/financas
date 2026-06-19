import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';

const C = { bg:'#0A0B0D', surface:'#131418', surface2:'#191B20', border:'rgba(255,255,255,0.08)', text:'#F3F4F6', text2:'#9CA2AC', faint:'#5F646C', accent:'#3ECF8E' };
const sans = "Inter, system-ui, -apple-system, sans-serif";
const mono = "'JetBrains Mono', ui-monospace, monospace";
const label = { fontFamily:mono, fontSize:10.5, letterSpacing:'0.12em', color:C.faint, textTransform:'uppercase', fontWeight:500 };

function useReveal() {
  const ref = useRef(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); o.disconnect(); } }, { threshold: 0.2 });
    o.observe(el); return () => o.disconnect();
  }, []);
  return [ref, v];
}
function Reveal({ children, delay=0, style }) {
  const [ref, v] = useReveal();
  return <div ref={ref} style={{ opacity:v?1:0, transform:v?'translateY(0)':'translateY(26px)', transition:`opacity .7s ease ${delay}s, transform .7s cubic-bezier(.2,.7,.2,1) ${delay}s`, ...style }}>{children}</div>;
}
function CountUp({ end, prefix='', duration=1600 }) {
  const [ref, v] = useReveal();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!v) return; let raf, start;
    const step = (t) => { if(!start) start=t; const p=Math.min((t-start)/duration,1); const e=1-Math.pow(1-p,3); setN(Math.round(end*e)); if(p<1) raf=requestAnimationFrame(step); };
    raf=requestAnimationFrame(step); return ()=>cancelAnimationFrame(raf);
  }, [v, end]);
  return <span ref={ref} className="tabular-nums">{prefix}{n.toLocaleString('pt-BR')}</span>;
}
function Ring({ pct=46, size=160 }) {
  const [ref, v] = useReveal();
  const r=(size-16)/2, circ=2*Math.PI*r;
  return (
    <div ref={ref} style={{ width:size, height:size, position:'relative' }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} stroke={C.surface2} strokeWidth={8} fill="none" />
        <circle cx={size/2} cy={size/2} r={r} stroke={C.accent} strokeWidth={8} fill="none" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={v?circ*(1-pct/100):circ} style={{ transition:'stroke-dashoffset 1.6s cubic-bezier(.2,.7,.2,1) .2s' }} />
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontSize:size*0.26, fontWeight:600, letterSpacing:'-0.03em' }} className="tabular-nums">{pct}%</span>
        <span style={{ ...label, fontSize:9 }}>liberdade</span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div style={{ background:C.bg, color:C.text, fontFamily:sans, width:'100%' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap');`}</style>

      {/* HERO — cinematográfico, full-bleed */}
      <section style={{ position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-200, left:'50%', transform:'translateX(-50%)', width:1100, height:600, background:'radial-gradient(ellipse, rgba(62,207,142,0.13), transparent 62%)', pointerEvents:'none' }} />
        <div className="px-6 md:px-12 lg:px-20" style={{ position:'relative', paddingTop:88, paddingBottom:88 }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center" style={{ maxWidth:1320, margin:'0 auto' }}>
            <Reveal>
              <div style={{ ...label, color:C.accent, marginBottom:22 }}>Patrimônio multimoeda · privado · cross-border</div>
              <h1 style={{ fontSize:'clamp(2.6rem, 5vw, 4.2rem)', fontWeight:700, letterSpacing:'-0.04em', lineHeight:1.02 }}>
                Sua vida financeira<br/>entre países, <span style={{ color:C.accent }}>só sua.</span>
              </h1>
              <p style={{ fontSize:17, color:C.text2, lineHeight:1.6, marginTop:24, maxWidth:480 }}>
                O painel completo pra gerir patrimônio e orçamento em qualquer moeda — com criptografia ponta a ponta. O servidor nunca vê os seus números.
              </p>
              <div className="flex flex-wrap gap-3" style={{ marginTop:32 }}>
                <button className="flex items-center gap-2" style={{ background:C.accent, color:'#06281C', fontWeight:600, fontSize:15, padding:'13px 22px', borderRadius:11, border:'none', cursor:'pointer' }}>Criar conta grátis <ArrowRight size={16} /></button>
                <button style={{ background:'transparent', color:C.text, fontWeight:600, fontSize:15, padding:'13px 22px', borderRadius:11, border:`1px solid ${C.border}`, cursor:'pointer' }}>Ver os recursos</button>
              </div>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="p-6" style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, boxShadow:'0 30px 80px -24px rgba(0,0,0,0.7)' }}>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div style={label}>Patrimônio líquido</div>
                    <div style={{ fontSize:38, fontWeight:700, letterSpacing:'-0.03em', marginTop:4 }}><CountUp end={1288433} prefix="R$ " /></div>
                    <div style={{ color:C.accent, fontSize:13, fontWeight:600, marginTop:6 }} className="tabular-nums">+2,9% no mês</div>
                  </div>
                  <Ring pct={46} size={104} />
                </div>
                <div className="flex rounded-full overflow-hidden" style={{ height:7, background:C.surface2 }}>
                  <div style={{ width:'86%', background:C.accent }} /><div style={{ width:'14%', background:'#5B6470' }} />
                </div>
                <div className="grid grid-cols-3 gap-3" style={{ marginTop:18 }}>
                  {[['Ativos','R$ 1,28M'],['Aporte','R$ 1.000'],['Livre em','2034']].map((s,i)=>(
                    <div key={i} className="p-3" style={{ background:C.surface2, borderRadius:10 }}>
                      <div style={{ ...label, fontSize:9 }}>{s[0]}</div>
                      <div style={{ fontSize:15, fontWeight:600, marginTop:3 }} className="tabular-nums">{s[1]}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* DECLARAÇÃO full-bleed — respiro / quebra de escala */}
      <section style={{ position:'relative', overflow:'hidden', borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ position:'absolute', bottom:-170, left:'50%', transform:'translateX(-50%)', width:900, height:420, background:'radial-gradient(ellipse, rgba(62,207,142,0.08), transparent 60%)', pointerEvents:'none' }} />
        <div className="px-6" style={{ position:'relative', paddingTop:120, paddingBottom:120, textAlign:'center' }}>
          <Reveal>
            <div style={{ ...label, marginBottom:20 }}>Privacidade por arquitetura</div>
            <h2 style={{ fontSize:'clamp(2.6rem, 6vw, 4.8rem)', fontWeight:700, letterSpacing:'-0.045em', lineHeight:1.04 }}>Seu dinheiro.<br/>Só seu.</h2>
            <p style={{ fontSize:17, color:C.text2, maxWidth:520, margin:'24px auto 0' }}>O dado financeiro nunca sai do seu navegador em texto claro. Nem nós conseguimos ver.</p>
          </Reveal>
        </div>
      </section>

      {/* LIBERDADE — vitrine assimétrica */}
      <section className="px-6 md:px-12 lg:px-20" style={{ paddingTop:100, paddingBottom:100 }}>
        <div style={{ maxWidth:1320, margin:'0 auto' }}>
          <Reveal>
            <div style={{ ...label, color:C.accent, marginBottom:14 }}>Liberdade · o diferencial</div>
            <h2 style={{ fontSize:'clamp(2rem, 4vw, 3.2rem)', fontWeight:700, letterSpacing:'-0.035em', maxWidth:620 }}>Quanto falta para você ser livre?</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center" style={{ marginTop:48 }}>
              <div className="lg:col-span-5 flex justify-center p-8" style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:24, position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:-100, left:'50%', transform:'translateX(-50%)', width:420, height:320, background:'radial-gradient(ellipse, rgba(62,207,142,0.12), transparent 65%)' }} />
                <div style={{ position:'relative' }}><Ring pct={46} size={240} /></div>
              </div>
              <div className="lg:col-span-7 grid grid-cols-2 gap-4">
                {[['Número da independência','R$ 2,76M','25× seu custo anual'],['Anos de liberdade','12,4 anos','cobertos hoje'],['Livre em','mar/2034','no ritmo atual'],['Constância','14 meses','recorde: 18 meses']].map((s,i)=>(
                  <div key={i} className="p-5" style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16 }}>
                    <div style={label}>{s[0]}</div>
                    <div style={{ fontSize:24, fontWeight:700, letterSpacing:'-0.02em', marginTop:8, color:i===0?C.accent:C.text }} className="tabular-nums">{s[1]}</div>
                    <div style={{ fontSize:12, color:C.faint, marginTop:3 }}>{s[2]}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <div style={{ textAlign:'center', padding:'36px', ...label }}>— amostra da direção · hero cinematográfico · respiro full-bleed · liberdade em destaque · com movimento</div>
    </div>
  );
}
