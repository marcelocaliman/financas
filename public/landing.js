/* Progressive enhancement da landing — a página já funciona 100% sem isto.
   Externo porque o CSP do app é script-src 'self' (bloqueia <script> inline).
   i18n por URL: cada idioma é uma página própria (/, /en, /it) gerada no build a partir
   de scripts/landing-i18n.json — bom p/ SEO. Aqui só marcamos o idioma e navegamos. */
(function () {
  var LABELS = { pt: "PT", en: "EN", it: "IT" };
  var URLS = { pt: "/", en: "/en", it: "/it" };

  // Idioma da página = atributo lang do HTML (cada URL já vem pré-renderizada no idioma).
  var l = (document.documentElement.lang || "pt").toLowerCase();
  var lang = l.indexOf("en") === 0 ? "en" : l.indexOf("it") === 0 ? "it" : "pt";

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
  // pra /en ou /it. Primeira visita NÃO redireciona — cada URL é rastreável (SEO limpo)
  // e o PT continua sendo o conteúdo da raiz.
  if (lang === "pt" && location.pathname === "/") {
    var saved = null;
    try { saved = localStorage.getItem("nf_lang"); } catch (e) {}
    if (saved === "en" || saved === "it") location.replace(URLS[saved]);
  }

  var y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());

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
  // Saída na hora ao fechar/navegar — o painel deixa de contar quase instantâneo (sem esperar a janela).
  window.addEventListener("pagehide", function (e) { if (!e.persisted) presPing(true); });

  // Painel do hero "ganha vida": count-up inicial e, em seguida, MODO VIVO contínuo —
  // o patrimônio cresce organicamente (random-walk com viés de alta + rajadas, ritmo
  // variável: às vezes devagar, às vezes rápido) e alguns KPIs oscilam de leve. Pausa
  // quando a aba/seção não está visível. Respeita prefers-reduced-motion (estático).
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function fmtNum(v, dec) {
    return v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  var liveEls = [], livePaused = false, heroVisible = true, liveStarted = false;
  function updatePaused() { livePaused = (typeof document.hidden !== "undefined" && document.hidden) || !heroVisible; }

  function startCountUp() {
    [].forEach.call(document.querySelectorAll("[data-count]"), function (el) {
      var base = parseFloat(el.getAttribute("data-count"));
      var dec = parseInt(el.getAttribute("data-dec") || "0", 10);
      var live = el.getAttribute("data-live"); // "grow" | "jitter" | null
      if (isNaN(base)) return;
      if (reduceMotion) { el.textContent = fmtNum(base, dec); return; }
      var dur = 1400, start = null;
      function step(ts) {
        if (start === null) start = ts;
        var p = Math.min(1, (ts - start) / dur);
        var e = 1 - Math.pow(1 - p, 3); // easeOutCubic
        el.textContent = fmtNum(base * e, dec);
        if (p < 1) requestAnimationFrame(step);
        else {
          el.textContent = fmtNum(base, dec);
          if (live) liveEls.push({ el: el, base: base, dec: dec, grow: live === "grow", value: base, vel: 0 });
        }
      }
      requestAnimationFrame(step);
    });
    if (!reduceMotion && !liveStarted) { liveStarted = true; liveLoop(); }
  }

  function liveLoop() {
    if (!livePaused) {
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
    }
    setTimeout(liveLoop, 70 + Math.random() * 150); // ritmo variável
  }

  document.addEventListener("visibilitychange", updatePaused);

  var heroFrame = document.querySelector(".hero .frame");
  if (heroFrame) {
    var begin = function () { heroFrame.classList.add("animate"); startCountUp(); };
    if ("IntersectionObserver" in window) {
      var startedAnim = false;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          heroVisible = en.isIntersecting; updatePaused();
          if (en.isIntersecting && !startedAnim) { startedAnim = true; begin(); }
        });
      }, { threshold: 0.2 });
      io.observe(heroFrame);
    } else { begin(); }
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
  var lang = l.indexOf("en") === 0 ? "en" : l.indexOf("it") === 0 ? "it" : "pt";
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
