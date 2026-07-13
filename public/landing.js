/* Progressive enhancement da landing — a página já funciona 100% sem isto.
   Externo porque o CSP do app é script-src 'self' (bloqueia <script> inline).
   i18n por URL: cada idioma é uma página própria (/, /en) gerada no build a partir
   de scripts/landing-i18n.json — bom p/ SEO. Aqui só marcamos o idioma e navegamos. */
(function () {
  var LABELS = { pt: "PT", en: "EN" };
  var URLS = { pt: "/", en: "/en" };

  // Idioma da página = atributo lang do HTML (cada URL já vem pré-renderizada no idioma).
  var l = (document.documentElement.lang || "pt").toLowerCase();
  var lang = l.indexOf("en") === 0 ? "en" : "pt";

  // Marca o idioma atual no seletor.
  var cur = document.getElementById("langcur");
  if (cur) cur.textContent = LABELS[lang] || "PT";
  [].forEach.call(document.querySelectorAll(".langmenu button"), function (b) {
    b.setAttribute("aria-current", b.getAttribute("data-lang") === lang ? "true" : "false");
  });

  // Dropdown de idioma — abre/fecha + navega pra URL do idioma (e lembra a escolha).
  var drop = document.getElementById("langdrop");
  var lbtn = document.getElementById("langbtn");
  var menu = document.getElementById("langmenu");
  function closeMenu() { if (drop) drop.classList.remove("open"); if (menu) menu.hidden = true; if (lbtn) lbtn.setAttribute("aria-expanded", "false"); }
  function openMenu() { if (drop) drop.classList.add("open"); if (menu) menu.hidden = false; if (lbtn) lbtn.setAttribute("aria-expanded", "true"); }
  if (lbtn) lbtn.addEventListener("click", function (e) { e.stopPropagation(); (menu && menu.hidden) ? openMenu() : closeMenu(); });
  // Seção em vista (última cujo topo já passou o header) — pra trocar de idioma SEM perder o lugar:
  // a outra URL (/, /en) abre na MESMA seção, não no topo. Só client-side (âncora #) → zero SEO.
  function sectionHash() {
    var secs = document.querySelectorAll("section[id]"), id = "";
    for (var i = 0; i < secs.length; i++) { if (secs[i].getBoundingClientRect().top - 90 <= 0) id = secs[i].id; }
    return id && id !== "topo" ? "#" + id : "";
  }
  [].forEach.call(document.querySelectorAll(".langmenu button"), function (b) {
    b.addEventListener("click", function () {
      var to = b.getAttribute("data-lang");
      try { localStorage.setItem("nf_lang", to); } catch (e) {}
      if (to !== lang) window.location.href = (URLS[to] || "/") + sectionHash(); else closeMenu();
    });
  });
  document.addEventListener("click", function (e) { if (drop && !drop.contains(e.target)) closeMenu(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });

  // Na raiz (/), respeita uma escolha de idioma já feita: manda o visitante recorrente
  // pra /en. Primeira visita NÃO redireciona — cada URL é rastreável (SEO limpo)
  // e o PT continua sendo o conteúdo da raiz.
  if (lang === "pt" && location.pathname === "/") {
    var saved = null;
    try { saved = localStorage.getItem("nf_lang"); } catch (e) {}
    if (saved === "en") location.replace(URLS.en + location.hash);
  }

  var y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());

  // Tema claro/escuro (botão visível). O estado inicial já veio do theme-init.js (sem flash);
  // aqui só tratamos o clique: alterna a classe, persiste em nf_theme e ajusta o theme-color.
  var themeBtn = document.getElementById("themebtn");
  if (themeBtn) {
    var themeMeta = document.querySelector('meta[name="theme-color"]');
    themeBtn.setAttribute("aria-label", { pt: "Alternar tema", en: "Toggle theme", it: "Cambia tema" }[lang] || "Alternar tema");
    themeBtn.addEventListener("click", function () {
      var light = !document.documentElement.classList.contains("light");
      document.documentElement.classList.toggle("light", light);
      if (themeMeta) themeMeta.setAttribute("content", light ? "#ecedef" : "#0a0b0d");
      try { localStorage.setItem("nf_theme", light ? "light" : "dark"); } catch (e) {}
    });
  }

  // Analytics próprio (privacy-first): mesmo coletor /api/track do app, sem cookie e
  // sem PII. O anon_id é de 1ª-parte (localStorage "nf-anon") e é compartilhado com o
  // app — costura o funil visita → cadastro sem identificar a pessoa.
  function anonId() {
    try {
      var id = localStorage.getItem("nf-anon");
      if (!id) { id = (String(Math.random()) + String(Math.random())).replace(/\D/g, "").slice(0, 24); localStorage.setItem("nf-anon", id); }
      return id;
    } catch (e) { return "anon"; }
  }
  function track(name) {
    try {
      var body = JSON.stringify({ n: name, s: "landing", a: anonId(), l: navigator.language || null, path: location.pathname, p: {} });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      else fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: body, keepalive: true });
    } catch (e) {}
  }
  track("landing_view");
  [].forEach.call(document.querySelectorAll('a[href^="/app"]'), function (a) {
    a.addEventListener("click", function () { track("cta_click"); });
  });

  // Logo / links "#top": o header é position:sticky (sempre no topo da viewport), então
  // o anchor nativo não rola. Forçamos a rolagem suave pro topo.
  [].forEach.call(document.querySelectorAll('a[href="#top"]'), function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
    });
  });

  // Presença "online agora" na landing (anônimo, sem cookie) — pinga /api/presence.
  function presSid() {
    try { var s = sessionStorage.getItem("nf-sid"); if (!s) { s = (String(Math.random()) + String(Math.random())).replace(/\D/g, "").slice(0, 32); sessionStorage.setItem("nf-sid", s); } return s; } catch (e) { return "anon"; }
  }
  function presPing(bye) {
    try {
      var body = JSON.stringify({ s: "landing", id: presSid(), bye: bye ? 1 : undefined });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/presence", new Blob([body], { type: "application/json" }));
      else fetch("/api/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: body, keepalive: true });
    } catch (e) {}
  }
  presPing();
  setInterval(function () { presPing(); }, 25000);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") presPing(); });
  // Saída na hora ao fechar/navegar — SEMPRE (não só !persisted) → o painel para de contar na hora.
  // Se voltar do bfcache, o pageshow(persisted) re-pinga e reaparece.
  window.addEventListener("pagehide", function () { presPing(true); });
  window.addEventListener("pageshow", function (e) { if (e.persisted) presPing(); });

  // Painel do hero "ganha vida": count-up inicial e, em seguida, MODO VIVO contínuo —
  // o patrimônio cresce organicamente (random-walk com viés de alta + rajadas, ritmo
  // variável: às vezes devagar, às vezes rápido) e alguns KPIs oscilam de leve. Pausa
  // quando a aba/seção não está visível. Respeita prefers-reduced-motion (estático).
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Formata no idioma da PÁGINA — senão /en mostraria "1.284.930" (separador pt-BR).
  var NUM_LOCALE = lang === "en" ? "en-US" : "pt-BR";
  function fmtNum(v, dec) {
    return v.toLocaleString(NUM_LOCALE, { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  var liveEls = [], livePaused = false, heroVisible = true, liveStarted = false, liveRunning = false;
  function updatePaused() {
    var was = livePaused;
    livePaused = (typeof document.hidden !== "undefined" && document.hidden) || !heroVisible;
    if (was && !livePaused && liveStarted && !liveRunning) { liveRunning = true; liveLoop(); } // retoma do idle
  }
  function startLive() { if (!reduceMotion && !liveStarted) { liveStarted = true; liveRunning = true; liveLoop(); } }

  // Count-up de UM elemento [data-count], disparado quando entra na viewport (não mais tudo de uma
  // vez). data-live="grow|jitter" mantém o número "vivo" depois (random-walk no liveLoop).
  function countEl(el) {
    if (el.__counted) return; el.__counted = true;
    var base = parseFloat(el.getAttribute("data-count"));
    var dec = parseInt(el.getAttribute("data-dec") || "0", 10);
    var live = el.getAttribute("data-live"); // "grow" | "jitter" | null
    if (isNaN(base)) return;
    if (reduceMotion) {
      el.textContent = fmtNum(base, dec);
      if (live) { liveEls.push({ el: el, base: base, dec: dec, grow: live === "grow", value: base, vel: 0 }); startLive(); }
      return;
    }
    var dur = 1400, start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      var e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = fmtNum(base * e, dec);
      if (p < 1) requestAnimationFrame(step);
      else {
        el.textContent = fmtNum(base, dec);
        if (live) { liveEls.push({ el: el, base: base, dec: dec, grow: live === "grow", value: base, vel: 0 }); startLive(); }
      }
    }
    requestAnimationFrame(step);
  }

  // ── EXTRAS DO HERO (extensão): gráfico, alocação por CLASSE (donut) e por MOEDA (BRL/EUR), e os
  //    anéis Liberdade/Saúde — COUPLED (cada alocação soma 100%) e mais devagar que os números. Lê
  //    a base do DOM e oscila PERTO dela (mean-revert): não foge, não dessincroniza, pausa junto.
  var lastExtras = 0;
  var heroExtras = (function () {
    var mock = document.querySelector(".hero-mock");
    if (!mock || reduceMotion) return null;
    function rw(cur, base, amp, lo, hi) {
      cur += (Math.random() - 0.5) * amp + (base - cur) * 0.1; // ruído + puxão de volta à base
      return cur < lo ? lo : cur > hi ? hi : cur;
    }
    var COLS = ["#3ECF8E", "#5FB394", "#8A8F98", "#6E7682", "#4B5159"];
    var donutEl = mock.querySelector(".mk-donut-ring");
    var legVals = [].slice.call(mock.querySelectorAll(".mk-legend .vl"));
    var clsBase = legVals.map(function (v) { return parseFloat(v.textContent) || 0; }), clsCur = clsBase.slice();
    var comp = mock.querySelector(".comp"), compSpans = comp ? [].slice.call(comp.children) : [];
    var chipNs = [].slice.call(mock.querySelectorAll(".chip .hx-n"));
    var curBase = chipNs.map(function (n) { return parseFloat(n.textContent) || 0; }), curCur = curBase.slice();
    compSpans.forEach(function (s) { s.style.transition = "width 1.2s ease"; });
    var gauges = [].slice.call(mock.querySelectorAll(".hm-statgrid .mk-stat")).map(function (st) {
      var cs = st.querySelectorAll("circle"), ring = cs[cs.length - 1], txt = st.querySelector(".mk-ring-v");
      var dash = parseFloat(ring.getAttribute("stroke-dasharray")) || 119.4;
      var base = (1 - parseFloat(ring.getAttribute("stroke-dashoffset")) / dash) * 100;
      ring.style.transition = "stroke-dashoffset 1.2s ease";
      return { ring: ring, txt: txt, dash: dash, base: base, cur: base, pct: !!(txt && txt.textContent.indexOf("%") >= 0) };
    });
    var spark = mock.querySelector(".spark"), paths = spark ? spark.querySelectorAll("path") : [], baseY = [];
    if (paths.length) { var mm, re = /[ML]\s*[\d.]+,([\d.]+)/g, dl = paths[paths.length - 1].getAttribute("d"); while ((mm = re.exec(dl))) baseY.push(parseFloat(mm[1])); }
    var curY = baseY.slice();
    function tick() {
      if (donutEl && legVals.length) {
        for (var i = 0; i < clsCur.length; i++) clsCur[i] = rw(clsCur[i], clsBase[i], clsBase[i] * 0.1, 2, 60);
        var s = 0; for (var a = 0; a < clsCur.length; a++) s += clsCur[a];
        var acc = 0, stops = [];
        for (var j = 0; j < clsCur.length; j++) { var p = clsCur[j] / s * 100, from = acc; acc += p; stops.push(COLS[j] + " " + from.toFixed(1) + "% " + (j === clsCur.length - 1 ? "100" : acc.toFixed(1)) + "%"); legVals[j].textContent = Math.round(p) + "%"; }
        donutEl.style.background = "conic-gradient(" + stops.join(", ") + ")";
      }
      if (chipNs.length === 2) {
        curCur[0] = rw(curCur[0], curBase[0], 1.6, 52, 74);
        var brl = Math.round(curCur[0]), eur = 100 - brl;
        chipNs[0].textContent = brl; chipNs[1].textContent = eur;
        if (compSpans.length >= 2) { compSpans[0].style.width = brl + "%"; compSpans[1].style.width = eur + "%"; }
      }
      for (var g = 0; g < gauges.length; g++) {
        var gg = gauges[g];
        gg.cur = rw(gg.cur, gg.base, gg.base * 0.06, Math.max(3, gg.base - 7), Math.min(99, gg.base + 7));
        if (gg.ring) gg.ring.setAttribute("stroke-dashoffset", (gg.dash * (1 - gg.cur / 100)).toFixed(1));
        if (gg.txt) gg.txt.textContent = gg.pct ? Math.round(gg.cur) + "%" : String(Math.round(gg.cur));
      }
      if (paths.length && baseY.length) {
        for (var k = 0; k < curY.length; k++) curY[k] = rw(curY[k], baseY[k], 2.2, 8, 92);
        var ln = "M0," + curY[0].toFixed(1);
        for (var x = 1; x < curY.length; x++) ln += " L" + (x * 32) + "," + curY[x].toFixed(1);
        if (paths[1]) paths[1].setAttribute("d", ln);
        if (paths[0]) paths[0].setAttribute("d", ln + " L320,98 L0,98 Z");
      }
    }
    return { tick: tick };
  })();

  function liveLoop() {
    if (livePaused) { liveRunning = false; return; } // fica IDLE enquanto pausado (sem timer girando)
    for (var i = 0; i < liveEls.length; i++) {
      var o = liveEls[i], amp = o.grow ? 1 : 0.5;
      o.vel += (Math.random() - 0.5) * o.base * 0.0001 * amp;       // ruído
      if (o.grow) o.vel += o.base * 0.0000045;                      // viés de alta SUAVE (só patrimônio)
      o.vel *= 0.86;                                                 // amortecimento
      // rajada ocasional BIDIRECIONAL: na maioria sobe, mas ÀS VEZES CAI um pouco (mais realista).
      if (Math.random() < 0.045) o.vel += (Math.random() - 0.42) * o.base * 0.0016 * amp;
      o.value += o.vel;
      var floor = o.base * (o.grow ? 0.982 : 0.985);                // grow pode recuar até ~-1,8%
      var ceil = o.base * (o.grow ? 1.08 : 1.02);
      if (o.value < floor) { o.value = floor; o.vel = Math.abs(o.vel) * 0.4; }
      if (o.value > ceil) { o.value = ceil; o.vel = -Math.abs(o.vel) * 0.4; }
      o.el.textContent = fmtNum(o.value, o.dec);
    }
    if (heroExtras) { var te = Date.now(); if (te - lastExtras > 1600) { lastExtras = te; heroExtras.tick(); } }
    setTimeout(liveLoop, 70 + Math.random() * 150); // ritmo variável
  }

  // Anéis que "preenchem" (.ring-fill): vazio = stroke-dashoffset == dasharray (circunferência);
  // cheio = data-off (alvo). Inline já traz o alvo (estado final sem JS).
  function ringEmpty(scope) {
    if (reduceMotion) return;
    [].forEach.call(scope.querySelectorAll(".ring-fill"), function (c) {
      c.style.strokeDashoffset = c.getAttribute("stroke-dasharray");
    });
  }
  function ringFill(scope) {
    [].forEach.call(scope.querySelectorAll(".ring-fill"), function (c) {
      var off = c.getAttribute("data-off"); if (off != null) c.style.strokeDashoffset = off;
    });
  }

  // Conta todos os [data-count] dentro de `scope` (idempotente via __counted).
  function countWithin(scope) { [].forEach.call(scope.querySelectorAll("[data-count]"), countEl); }

  document.addEventListener("visibilitychange", updatePaused);

  var hasIO = "IntersectionObserver" in window;

  if (hasIO && !reduceMotion) {
    // Reveals: armamos (escondemos) só o que está ABAIXO da dobra — o topo nunca pisca. O count-up
    // dispara JUNTO com o reveal (não por geometria solta), pra não rodar com o painel ainda invisível.
    var revIO = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("in"); ringFill(en.target); countWithin(en.target); revIO.unobserve(en.target);
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -7% 0px" });
    [].forEach.call(document.querySelectorAll(".reveal, .stagger"), function (el) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) { el.classList.add("in"); ringFill(el); countWithin(el); }
      else { el.classList.add("armed"); ringEmpty(el); revIO.observe(el); }
    });
    // [data-count] que NÃO está dentro de um reveal/stagger conta por geometria (fallback).
    var cntIO = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { countEl(en.target); cntIO.unobserve(en.target); } });
    }, { threshold: 0.45 });
    [].forEach.call(document.querySelectorAll("[data-count]"), function (el) {
      if (!el.closest(".reveal, .stagger")) cntIO.observe(el);
    });
  } else {
    // Sem IO ou reduced-motion: tudo no estado final, na hora.
    [].forEach.call(document.querySelectorAll(".reveal, .stagger"), function (el) { el.classList.add("in"); });
    ringFill(document);
    countWithin(document);
  }

  // Hero: dispara as animações CSS do painel (anel, barras, linha, KPIs) ao aparecer, e controla a
  // pausa do "modo vivo" quando a aba/seção não está visível.
  var heroFrame = document.querySelector(".hero .frame");
  if (heroFrame) {
    if (hasIO) {
      var startedAnim = false;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          heroVisible = en.isIntersecting; updatePaused();
          if (en.isIntersecting && !startedAnim) { startedAnim = true; heroFrame.classList.add("animate"); }
        });
      }, { threshold: 0.2 });
      io.observe(heroFrame);
    } else { heroFrame.classList.add("animate"); }
  }

  // Headline ROTATIVA: cruza entre as frases (fade + subida). Pausa com aba oculta;
  // reduced-motion / 1 frase só → fica estática na primeira.
  var rot = document.querySelector(".hero-rot");
  if (rot && !reduceMotion) {
    var rotItems = rot.querySelectorAll(".rot-item");
    if (rotItems.length > 1) {
      var rotIdx = 0;
      setInterval(function () {
        if (typeof document.hidden !== "undefined" && document.hidden) return;
        var cur = rotItems[rotIdx];
        rotIdx = (rotIdx + 1) % rotItems.length;
        var nxt = rotItems[rotIdx];
        cur.classList.remove("is-on"); cur.classList.add("is-out"); cur.setAttribute("aria-hidden", "true");
        nxt.classList.remove("is-out"); nxt.classList.add("is-on"); nxt.setAttribute("aria-hidden", "false");
      }, 4000);
    }
  }
})();

/* Formulário de contato → abre um ticket de convidado em /api/ticket (com Turnstile invisível).
   Sem conta: a resposta chega por um link rastreável (/ticket?t=…) enviado por e-mail. */
(function () {
  var form = document.getElementById("contactForm");
  if (!form) return;
  var SITE_KEY = "0x4AAAAAADnX32Qstm3PaHoz";
  var statusEl = document.getElementById("cfStatus");
  var submitBtn = document.getElementById("cfSubmit");
  var tsId = null, tsReady = false, resolveToken = null;

  var s = document.createElement("script");
  s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
  s.async = true; s.defer = true;
  s.onload = function () {
    try {
      tsId = window.turnstile.render("#cfTs", {
        sitekey: SITE_KEY, size: "invisible",
        callback: function (tok) { if (resolveToken) resolveToken(tok); },
        "error-callback": function () { if (resolveToken) resolveToken(null); },
        "timeout-callback": function () { if (resolveToken) resolveToken(null); },
      });
      tsReady = true;
    } catch (e) {}
  };
  document.head.appendChild(s);

  function getToken() {
    return new Promise(function (resolve) {
      if (!tsReady || !window.turnstile || tsId == null) return resolve(null);
      resolveToken = resolve;
      try { window.turnstile.reset(tsId); window.turnstile.execute(tsId); }
      catch (e) { resolveToken = null; return resolve(null); }
      setTimeout(function () { if (resolveToken === resolve) { resolveToken = null; resolve(null); } }, 9000);
    });
  }

  var l = (document.documentElement.lang || "pt").toLowerCase();
  var lang = l.indexOf("en") === 0 ? "en" : "pt";
  var MSG = {
    sending: { pt: "Enviando…", en: "Sending…", it: "Invio…" },
    ok: { pt: "Recebido! Te enviamos um link por e-mail pra acompanhar a conversa.", en: "Got it! We've emailed you a link to follow the conversation.", it: "Ricevuto! Ti abbiamo inviato un link via email per seguire la conversazione." },
    err: { pt: "Não foi possível enviar. Tente de novo.", en: "Couldn't send. Try again.", it: "Invio non riuscito. Riprova." },
    captcha: { pt: "Verificação de segurança falhou. Recarregue e tente de novo.", en: "Security check failed. Reload and try again.", it: "Verifica di sicurezza non riuscita. Ricarica e riprova." },
  };
  function msg(k) { return (MSG[k] && MSG[k][lang]) || MSG[k].pt; }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = (document.getElementById("cfEmail").value || "").trim();
    var subject = (document.getElementById("cfSubject").value || "").trim();
    var message = (document.getElementById("cfMessage").value || "").trim();
    if (!email || !subject || !message) return;
    submitBtn.disabled = true;
    statusEl.className = "cf-status";
    statusEl.textContent = msg("sending");
    getToken().then(function (token) {
      var body = JSON.stringify({ email: email, subject: subject, body: message, category: "duvida", locale: lang, captcha: token, meta: { referrer: (document.referrer || "").slice(0, 160) } });
      return fetch("/api/ticket?action=create", { method: "POST", headers: { "Content-Type": "application/json" }, body: body });
    }).then(function (r) {
      if (r.ok) { statusEl.className = "cf-status ok"; statusEl.textContent = msg("ok"); form.reset(); return; }
      return r.json().then(function (d) {
        statusEl.className = "cf-status err";
        statusEl.textContent = d && d.error === "captcha_failed" ? msg("captcha") : msg("err");
      });
    }).catch(function () {
      statusEl.className = "cf-status err"; statusEl.textContent = msg("err");
    }).finally(function () { submitBtn.disabled = false; });
  });
})();

// ── Instalação como app (PWA) na landing ───────────────────────────────────────
// Android/desktop Chrome: captura o beforeinstallprompt e instala com 1 toque (o app abre
// em /app pelo start_url do manifesto). iOS: oferece "Abrir no app" (instalar de lá, em
// standalone). Some se já instalado ou dispensado (lembrado ~3 semanas).
(function () {
  var bar = document.getElementById("installbar");
  if (!bar) return;
  var btn = document.getElementById("installbtn");
  var ios = document.getElementById("installios");
  var x = document.getElementById("installx");
  var KEY = "nf-install-dismissed";
  function standalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  }
  function dismissedRecently() {
    try { var v = Number(localStorage.getItem(KEY)); return !!v && Date.now() - v < 21 * 86400000; } catch (e) { return false; }
  }
  function isIOS() {
    var ua = navigator.userAgent || "";
    return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  }
  function isMobile() {
    var ua = navigator.userAgent || "";
    return /android|iphone|ipad|ipod|mobile|silk|kindle/i.test(ua) || isIOS();
  }
  // Só no celular (pedido do dono): no desktop o banner não aparece, mesmo que dê pra instalar.
  if (standalone() || dismissedRecently() || !isMobile()) return;

  var deferred = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    if (btn) btn.hidden = false;
    bar.hidden = false;
  });
  if (isIOS() && ios) { ios.hidden = false; bar.hidden = false; }

  if (btn) btn.addEventListener("click", function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.then(function () { deferred = null; bar.hidden = true; });
  });
  if (x) x.addEventListener("click", function () {
    try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
    bar.hidden = true;
  });
  window.addEventListener("appinstalled", function () { bar.hidden = true; });
})();

/* (Removido: card/lista de espera do "Pro Investidor" — plano descontinuado no pivô p/ Pro único.) */

/* Mock do app (seção "quem construiu"): faz o TOUR das telas — troca a tela ativa a cada ~4.2s,
   e cada uma remonta ao ativar (via CSS). Só roda quando visível na tela e com a aba ativa.
   Respeita prefers-reduced-motion (aí fica só a 1ª tela, montada). */
(function () {
  var mock = document.querySelector(".appmock");
  if (!mock) return;
  var screens = mock.querySelectorAll(".am-screen");
  if (screens.length < 2) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var i = 0, timer = null, onscreen = true;
  function show(n) {
    screens[i].classList.remove("is-active");
    i = (n + screens.length) % screens.length;
    screens[i].classList.add("is-active");
  }
  function start() { if (!timer) timer = setInterval(function () { show(i + 1); }, 4200); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function sync() { (onscreen && document.visibilityState === "visible") ? start() : stop(); }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { onscreen = es[0].isIntersecting; sync(); }, { threshold: 0.25 }).observe(mock);
  } else { start(); }
  document.addEventListener("visibilitychange", sync);
})();

/* Época do IRPF (1/fev–31/mai): destaque AUTOMÁTICO do organizador — liga e desliga sozinho
   pela data do visitante, sem deploy nem cron (a página é estática o ano todo; o JS só revela).
   Na janela: (1) o bullet do IRPF sobe pro topo do card Pro (logo após "tudo do grátis") com
   peso maior; (2) a seção do Leão ganha o chip de época e o CTA vira o convite direto pro Pro.
   Fora da janela, nada muda. Textos vêm do HTML já traduzido (build) — o JS só move/alterna. */
(function () {
  var m = new Date().getMonth() + 1; // 1–12, fuso do visitante
  if (m < 2 || m > 5) return;
  var li = document.querySelector('li[data-i18n="planos.pIr"]');
  if (li && li.parentElement) {
    var first = li.parentElement.querySelector('li[data-i18n="planos.p1"]');
    if (first) first.insertAdjacentElement("afterend", li);
    li.classList.add("hot");
  }
  var chip = document.getElementById("ir-season-chip");
  if (chip) chip.hidden = false;
  var def = document.getElementById("ir-cta-default");
  var hot = document.getElementById("ir-cta-season");
  if (def && hot) { def.hidden = true; hot.hidden = false; }
})();
