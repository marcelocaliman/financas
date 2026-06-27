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
  [].forEach.call(document.querySelectorAll(".langmenu button"), function (b) {
    b.addEventListener("click", function () {
      var to = b.getAttribute("data-lang");
      try { localStorage.setItem("nf_lang", to); } catch (e) {}
      if (to !== lang) window.location.href = URLS[to] || "/"; else closeMenu();
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
    if (saved === "en") location.replace(URLS.en);
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

  function liveLoop() {
    if (livePaused) { liveRunning = false; return; } // fica IDLE enquanto pausado (sem timer girando)
    for (var i = 0; i < liveEls.length; i++) {
      var o = liveEls[i], amp = o.grow ? 1 : 0.5;
      o.vel += (Math.random() - 0.5) * o.base * 0.0001 * amp;       // ruído
      if (o.grow) o.vel += o.base * 0.000006;                       // viés de alta (só patrimônio)
      o.vel *= 0.86;                                                 // amortecimento
      if (Math.random() < 0.03) o.vel += Math.random() * o.base * 0.0008 * amp; // rajada ocasional
      o.value += o.vel;
      var floor = o.base * (o.grow ? 0.997 : 0.985);
      var ceil = o.base * (o.grow ? 1.08 : 1.02);
      if (o.value < floor) { o.value = floor; o.vel = Math.abs(o.vel) * 0.4; }
      if (o.value > ceil) { o.value = ceil; o.vel = -Math.abs(o.vel) * 0.4; }
      o.el.textContent = fmtNum(o.value, o.dec);
    }
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

/* Pro Investidor na landing: o card é SEMPRE visível. Por padrão fica em modo "Em breve" (lista
   de espera). Quando a flag quotes_live está ON (/api/public-config), o card vira "Assinar". */
(function () {
  try {
    fetch("/api/public-config")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (c) {
        if (c && c.quotesLive) {
          var grid = document.querySelector("#planos .plans");
          if (grid) grid.classList.add("inv-live");
        }
      })
      .catch(function () {});
  } catch (e) {}
})();

/* Lista de espera do Pro Investidor (modo "Em breve"): capta email → /api/waitlist, com Turnstile
   invisível carregado SOB DEMANDA (o formulário de contato não existe nesta página). */
(function () {
  var form = document.getElementById("invWaitForm");
  if (!form) return;
  var SITE_KEY = "0x4AAAAAADnX32Qstm3PaHoz";
  var emailEl = document.getElementById("invWaitEmail");
  var btn = document.getElementById("invWaitBtn");
  var statusEl = document.getElementById("invWaitStatus");
  var tsId = null, tsReady = false, resolveToken = null;

  function ensureTurnstile(cb) {
    if (window.turnstile) return cb();
    if (document.querySelector('script[src*="turnstile/v0/api.js"]')) {
      var iv = setInterval(function () { if (window.turnstile) { clearInterval(iv); cb(); } }, 120);
      setTimeout(function () { clearInterval(iv); }, 8000);
      return;
    }
    var s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true; s.defer = true;
    s.onload = cb;
    document.head.appendChild(s);
  }
  ensureTurnstile(function () {
    try {
      tsId = window.turnstile.render("#invTs", {
        sitekey: SITE_KEY, size: "invisible",
        callback: function (tok) { if (resolveToken) resolveToken(tok); },
        "error-callback": function () { if (resolveToken) resolveToken(null); },
        "timeout-callback": function () { if (resolveToken) resolveToken(null); },
      });
      tsReady = true;
    } catch (e) {}
  });
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
    sending: { pt: "Enviando…", en: "Sending…" },
    ok: { pt: "Pronto! A gente te avisa quando lançar.", en: "Done! We'll let you know when it launches." },
    err: { pt: "Não foi possível enviar. Tente de novo.", en: "Couldn't send. Try again." },
    invalid: { pt: "Confira o email.", en: "Check the email." },
  };
  function msg(k) { return (MSG[k] && MSG[k][lang]) || MSG[k].pt; }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = (emailEl.value || "").trim();
    if (!email || email.indexOf("@") < 1) { statusEl.className = "inv-wait-status err"; statusEl.textContent = msg("invalid"); return; }
    btn.disabled = true;
    statusEl.className = "inv-wait-status";
    statusEl.textContent = msg("sending");
    getToken().then(function (token) {
      return fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, ts: token, lang: lang }),
      });
    }).then(function (r) {
      if (r && r.ok) { statusEl.className = "inv-wait-status ok"; statusEl.textContent = msg("ok"); form.reset(); }
      else { statusEl.className = "inv-wait-status err"; statusEl.textContent = msg("err"); btn.disabled = false; }
    }).catch(function () {
      statusEl.className = "inv-wait-status err"; statusEl.textContent = msg("err"); btn.disabled = false;
    });
  });
})();
