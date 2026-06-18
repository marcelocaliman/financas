/* Progressive enhancement da landing — a página já funciona 100% sem isto.
   Externo porque o CSP do app é script-src 'self' (bloqueia <script> inline).
   i18n: PT é o conteúdo do HTML (fallback); EN/IT trocam o textContent. */
(function () {
  var I18N = { "en": {"nav.recursos":"Features","nav.liberdade":"Freedom","nav.privacidade":"Privacy","nav.faq":"FAQ","nav.contato":"Contact","nav.cta":"Create account","hero.eyebrow":"Multicurrency wealth · private · cross-border","hero.h1a":"Your financial life between countries,","hero.h1b":"yours alone.","hero.sub":"The complete dashboard to manage your wealth in any currency and country — whether you live between countries, are moving, or just want everything organized in one place. With end-to-end encryption: the server never sees your numbers.","hero.cta1":"Create free account","hero.cta2":"See the features","hero.m1":"End-to-end encryption (E2EE)","hero.m2":"Works offline (local-first)","mock.tagline":"Consistency becomes freedom","mock.networth":"Net worth","mock.vsmonth":"vs. last month","mock.liberdade":"Freedom","mock.years":"12.4 years of freedom covered","mock.comp":"Breakdown by currency","mock.trend":"Net worth trend","mock.balance":"Month's balance","mock.return":"Return","mock.reserve":"Reserve","mock.reserveV":"8.2 months","mock.due":"Due soon","mock.dueV":"3 bills","stat.e2ee":"End-to-end encryption","stat.cur":"Currencies (BRL · EUR · USD · GBP…)","stat.lang":"Languages (PT · EN · IT)","stat.zero":"Plaintext data on the server","pil.eyebrow":"Why it exists","pil.h2":"Simple, yet complete. And truly private.","pil.p":"Personal finance is a crowded market — but multicurrency, borderless and truly private is poorly served. Whether you're an expat, a nomad, moving abroad, or just someone with wealth in more than one currency.","pil.1t":"Truly multicurrency","pil.1p":"Each asset keeps its own currency. See everything converted to any display currency, with live exchange rates and a manual fallback.","pil.2t":"Private by encryption","pil.2p":"E2EE: your data leaves the browser already encrypted. The key is born from your password and is never transmitted. Not even we can read it.","pil.3t":"Local-first","pil.3p":"Instant and offline; syncs on its own in the background. Clearing your browser loses nothing — the encrypted vault lives on the server.","pil.4t":"Built for cross-border","pil.4p":"Designed for expats, nomads and anyone with income or wealth in more than one country. From income in one currency to property in another — all in one place.","f1.eyebrow":"Wealth & Investments","f1.h2":"From real estate to satoshis.","f1.p":"Assets, liabilities, classes and subtypes. Current vs. target allocation to rebalance, automatic quotes for stocks and REITs, and net worth always right — in any currency.","f1.l1":"Breakdown by class and by currency","f1.l2":"Return, average price and performance","f1.l3":"Debt schedule and amortization","f1.alloc":"Allocation","f1.target":"vs. target","f1.invested":"INVESTED","f1.rf":"Fixed income","f1.ac":"Stocks & ETFs","f1.cripto":"Crypto","f2.eyebrow":"Budget","f2.h2":"Every dollar — and every euro — in its place.","f2.p":"Income and spending by category, multicurrency, with recurring entries that post themselves and bills with due dates. Budgeted vs. actual, month by month.","f2.l1":"Recurring entries and bills to pay","f2.l2":"Month's savings rate","f2.l3":"Monthly summary in PDF","f2.month":"June · spending by category","f2.saldo":"balance","f2.c1":"Housing","f2.c2":"Food","f2.c3":"Transport","f2.c4":"Leisure","f3.eyebrow":"History","f3.h2":"Watch your money work.","f3.p":"Your net worth evolving month by month — and how much of the growth came from your pocket (contributions) and how much from returns. The “work of money,” broken out.","f3.l1":"Contributions vs. returns","f3.l2":"Automatic net worth snapshot","f3.k1":"Current","f3.k2":"Growth","f3.k3":"Contributions","f3.k4":"Returns","f3.leg1":"Net worth","f3.leg2":"Contributions only","lib.eyebrow":"Freedom — the differentiator","lib.h2":"How far are you from being free?","lib.p":"Serious gamification — no badges, no confetti. Net worth becomes tangible progress toward financial independence: your %, the independence number, the years covered, your arrival date and your consistency.","lib.head":"You're 46% of the way to freedom","lib.indep":"Independence number:","lib.mult":"≈ 25× your annual cost","lib.yc":"Years covered","lib.ycv":"12.4 years","lib.eta":"Estimated arrival","lib.streak":"Consistency","lib.cur":"current streak","lib.rec":"record","lib.streakh":"Months in a row in the black — income above spending.","lib.health":"Financial health","lib.healthv":"/ 100 · excellent","lib.s1":"Savings","lib.s2":"Diversification","lib.s3":"Reserve","lib.marcos":"Milestones","lib.m25":"25% free","lib.mres":"Emergency fund complete","lib.m50":"50% free","lib.next":"next","f4.eyebrow":"Projection & Goals","f4.h2":"The future, in numbers.","f4.p":"Compound interest on net worth and contributions, across optimistic / base / pessimistic scenarios, nominal and in today's value. Plus goals with a progress bar and an arrival date at your pace.","f4.l1":"Multi-scenario and FIRE number","f4.l2":"Goals with “estimated arrival”","f4.proj":"Projection · 20 years","f4.opt":"Optimistic","f4.base":"Base","f4.pess":"Pessimistic","f4.g1":"Own home","f4.g2":"12m reserve","f4.reached":"reached","priv.eyebrow":"Privacy","priv.h2":"The server never sees your numbers.","priv.p":"Your financial data only reaches the server encrypted. The key is derived from your password by a strong KDF (Argon2id) and is never transmitted. At signup you get a recovery code — the one and only backup.","priv.l1":"Encrypts and decrypts only in the browser (E2EE)","priv.l2":"No email recovery of your data: the key is yours","priv.l3":"Export/import: you own your data (JSON and CSV)","priv.box":"what the server stores","priv.you":"YOU","priv.val":"net worth: R$ 1,284,930","priv.arrow":"↓ encrypted in your browser ↓","priv.srv":"SERVER","priv.cipher":"sees only ciphertext — never the value","mm.eyebrow":"Multicurrency & cross-border","mm.h2":"Any country, any currency.","mm.p":"Income in one currency, investments in another, an account in a third country — or all in the same place. Each item keeps its own currency; you choose the display currency and see everything converted, with live exchange rates.","faq.eyebrow":"Frequently asked questions","faq.h2":"Everything you want to know.","faq.q1":"Is it free?","faq.a1":"Yes. The app is free and private. The idea is to deliver real value first; a paid tier (like cross-device sync and advanced features) may come later, always optional.","faq.q2":"Is my data safe? Who can see it?","faq.a2":"Only you. Your financial data is encrypted in your browser (E2EE) before it leaves. The server stores only an encrypted blob — never the values in plaintext. Not even we can read it.","faq.q3":"Does it work offline?","faq.a3":"Yes. It's local-first: it runs instantly and offline, and syncs on its own in the background when there's a connection. Clearing your browser loses nothing — the encrypted vault lives on the server.","faq.q4":"Which currencies and countries does it work in?","faq.a4":"Any country. Each item keeps its own currency (BRL, EUR, USD, GBP and more) and you pick the display currency — all converted with live exchange rates and a manual fallback.","faq.q5":"What if I forget my password?","faq.a5":"At signup you get a recovery code — keep it safe. Since encryption is end-to-end, there's no email recovery of your data: the key is yours, and the code is the only backup.","faq.q6":"Can I export my data?","faq.a6":"Yes. You export and import everything in JSON (full backup) and CSV (interoperable). The data is yours — it comes in and out whenever you want.","faq.q7":"Can I use it yet? How do I get in?","faq.a7":"Yes! Just create a free account and get started — it takes a minute. Your data is encrypted end-to-end, right in your browser, from the start.","faq.q8":"In which languages?","faq.a8":"Portuguese, English and Italian — and the app works in any country and currency.","ct.eyebrow":"Get started","ct.h2":"Get started. It's free and private.","ct.p":"Create your account in a minute and start organizing your wealth in any currency. Free, private, no card.","ct.btn":"Create free account","ct.legal":"Free, no card. Your data is end-to-end encrypted — not even we can read it.","ct.d1":"Talk to me directly","ct.d2":"Questions, partnerships, feedback","ct.r1":"Private from day 1","ct.r2":"Your numbers are yours — end-to-end encryption","foot.tag":"Multicurrency, private and borderless wealth. For anyone who lives, invests or moves between countries and currencies.","foot.legal":"Privacy by end-to-end encryption · LGPD/GDPR","mm.fx":"Illustrative rates — live in the app.","nav.login":"Log in"}, "it": {"nav.recursos":"Funzioni","nav.liberdade":"Libertà","nav.privacidade":"Privacy","nav.faq":"FAQ","nav.contato":"Contatti","nav.cta":"Crea account","hero.eyebrow":"Patrimonio multivaluta · privato · cross-border","hero.h1a":"La tua vita finanziaria tra paesi,","hero.h1b":"solo tua.","hero.sub":"La dashboard completa per gestire il tuo patrimonio in qualsiasi valuta e paese — che tu viva tra paesi, ti stia trasferendo, o voglia solo tutto in un unico posto. Con crittografia end-to-end: il server non vede mai i tuoi numeri.","hero.cta1":"Crea account gratis","hero.cta2":"Scopri le funzioni","hero.m1":"Crittografia end-to-end (E2EE)","hero.m2":"Funziona offline (local-first)","mock.tagline":"La costanza diventa libertà","mock.networth":"Patrimonio netto","mock.vsmonth":"vs. mese precedente","mock.liberdade":"Libertà","mock.years":"12,4 anni di libertà coperti","mock.comp":"Composizione per valuta","mock.trend":"Andamento del patrimonio","mock.balance":"Saldo del mese","mock.return":"Rendimento","mock.reserve":"Riserva","mock.reserveV":"8,2 mesi","mock.due":"In scadenza","mock.dueV":"3 conti","stat.e2ee":"Crittografia end-to-end","stat.cur":"Valute (BRL · EUR · USD · GBP…)","stat.lang":"Lingue (PT · EN · IT)","stat.zero":"Dati in chiaro sul server","pil.eyebrow":"Perché esiste","pil.h2":"Semplice, ma completo. E davvero privato.","pil.p":"La finanza personale è un mercato affollato — ma multivaluta, senza confini e davvero privata è mal servita. Che tu sia un expat, un nomade, in trasferimento, o semplicemente con un patrimonio in più di una valuta.","pil.1t":"Multivaluta sul serio","pil.1p":"Ogni asset conserva la propria valuta. Vedi tutto convertito in qualsiasi valuta di visualizzazione, con cambio in tempo reale e fallback manuale.","pil.2t":"Privato per crittografia","pil.2p":"E2EE: il dato lascia il browser già cifrato. La chiave nasce dalla tua password e non viene mai trasmessa. Nemmeno noi possiamo leggere.","pil.3t":"Local-first","pil.3p":"Istantaneo e offline; sincronizza da solo in background. Svuotare il browser non perde nulla — il caveau cifrato vive sul server.","pil.4t":"Pensato per il cross-border","pil.4p":"Pensato per expat, nomadi e chiunque abbia redditi o patrimonio in più di un paese. Dal reddito in una valuta all'immobile in un'altra — tutto in un unico posto.","f1.eyebrow":"Patrimonio & Investimenti","f1.h2":"Dall'immobile al satoshi.","f1.p":"Attivi, passivi, classi e sottotipi. Allocazione attuale vs. target per ribilanciare, quotazioni automatiche di azioni e fondi, e patrimonio netto sempre esatto — in qualsiasi valuta.","f1.l1":"Composizione per classe e per valuta","f1.l2":"Rendimento, prezzo medio e redditività","f1.l3":"Piano di ammortamento dei debiti","f1.alloc":"Allocazione","f1.target":"vs. target","f1.invested":"INVESTITO","f1.rf":"Reddito fisso","f1.ac":"Azioni & ETF","f1.cripto":"Cripto","f2.eyebrow":"Budget","f2.h2":"Ogni real — e ogni euro — al suo posto.","f2.p":"Entrate e spese per categoria, multivaluta, con movimenti ricorrenti automatici e conti da pagare con scadenza. Budget vs. consuntivo, mese per mese.","f2.l1":"Ricorrenze e conti da pagare","f2.l2":"Tasso di risparmio del mese","f2.l3":"Riepilogo mensile in PDF","f2.month":"Giugno · spese per categoria","f2.saldo":"saldo","f2.c1":"Casa","f2.c2":"Alimentazione","f2.c3":"Trasporti","f2.c4":"Svago","f3.eyebrow":"Storico","f3.h2":"Guarda il denaro lavorare.","f3.p":"L'evoluzione del tuo patrimonio mese per mese — e quanta crescita è venuta dalle tue tasche (versamenti) e quanta dal rendimento. Il “lavoro del denaro”, distinto.","f3.l1":"Versamenti vs. rendimento","f3.l2":"Snapshot automatico del patrimonio","f3.k1":"Attuale","f3.k2":"Crescita","f3.k3":"Versamenti","f3.k4":"Rendimento","f3.leg1":"Patrimonio","f3.leg2":"Solo versamenti","lib.eyebrow":"Libertà — il valore distintivo","lib.h2":"Quanto manca per essere libero?","lib.p":"La gamification seria — senza badge, senza coriandoli. Il patrimonio diventa progresso tangibile verso l'indipendenza finanziaria: la tua %, il numero dell'indipendenza, gli anni coperti, la data di arrivo e la costanza.","lib.head":"Sei al 46% della libertà","lib.indep":"Numero dell'indipendenza:","lib.mult":"≈ 25× il tuo costo annuo","lib.yc":"Anni coperti","lib.ycv":"12,4 anni","lib.eta":"Arrivo stimato","lib.streak":"Costanza","lib.cur":"sequenza attuale","lib.rec":"record","lib.streakh":"Mesi consecutivi in positivo — entrate sopra le spese.","lib.health":"Salute finanziaria","lib.healthv":"/ 100 · eccellente","lib.s1":"Risparmio","lib.s2":"Diversificazione","lib.s3":"Riserva","lib.marcos":"Traguardi","lib.m25":"25% libero","lib.mres":"Fondo di emergenza completo","lib.m50":"50% libero","lib.next":"prossimo","f4.eyebrow":"Proiezione & Obiettivi","f4.h2":"Il futuro, in numeri.","f4.p":"Interesse composto su patrimonio e versamenti, in scenari ottimista / base / pessimista, nominale e in valore di oggi. E obiettivi con barra di avanzamento e data di arrivo al tuo ritmo.","f4.l1":"Multi-scenario e numero FIRE","f4.l2":"Obiettivi con “arrivo stimato”","f4.proj":"Proiezione · 20 anni","f4.opt":"Ottimista","f4.base":"Base","f4.pess":"Pessimista","f4.g1":"Casa di proprietà","f4.g2":"Riserva 12m","f4.reached":"raggiunto","priv.eyebrow":"Privacy","priv.h2":"Il server non vede mai i tuoi numeri.","priv.p":"Il tuo dato finanziario va al server solo cifrato. La chiave è derivata dalla tua password con un KDF forte (Argon2id) e non viene mai trasmessa. Alla registrazione ricevi un codice di recupero — l'unica seconda via.","priv.l1":"Cifra e decifra solo nel browser (E2EE)","priv.l2":"Nessun recupero del dato via e-mail: la chiave è tua","priv.l3":"Export/import: i dati sono tuoi (JSON e CSV)","priv.box":"cosa conserva il server","priv.you":"TU","priv.val":"patrimonio: R$ 1.284.930","priv.arrow":"↓ cifrato nel tuo browser ↓","priv.srv":"SERVER","priv.cipher":"vede solo ciphertext — mai il valore","mm.eyebrow":"Multivaluta & cross-border","mm.h2":"Qualsiasi paese, qualsiasi valuta.","mm.p":"Reddito in una valuta, investimenti in un'altra, un conto in un terzo paese — o tutto nello stesso posto. Ogni voce mantiene la propria valuta; scegli la valuta di visualizzazione e vedi tutto convertito, con cambi in tempo reale.","faq.eyebrow":"Domande frequenti","faq.h2":"Tutto quello che vuoi sapere.","faq.q1":"È gratis?","faq.a1":"Sì. L'app è gratuita e privata. L'idea è offrire valore reale prima; un livello a pagamento (come la sincronizzazione tra dispositivi e funzioni avanzate) potrà arrivare dopo, sempre opzionale.","faq.q2":"I miei dati sono al sicuro? Chi può vederli?","faq.a2":"Solo tu. Il dato finanziario è cifrato nel tuo browser (E2EE) prima di uscire. Il server conserva solo un blob cifrato — mai i valori in chiaro. Nemmeno noi possiamo leggerli.","faq.q3":"Funziona offline?","faq.a3":"Sì. È local-first: gira istantaneo e offline, e sincronizza da solo in background quando c'è connessione. Svuotare il browser non perde nulla — il caveau cifrato vive sul server.","faq.q4":"In quali valute e paesi funziona?","faq.a4":"In qualsiasi paese. Ogni voce conserva la propria valuta (BRL, EUR, USD, GBP e altre) e tu scegli la valuta di visualizzazione — tutto convertito con cambio in tempo reale e fallback manuale.","faq.q5":"E se dimentico la password?","faq.a5":"Alla registrazione ricevi un codice di recupero — conservalo bene. Poiché la crittografia è end-to-end, non esiste recupero del dato via e-mail: la chiave è tua, e il codice è l'unica seconda via.","faq.q6":"Posso esportare i miei dati?","faq.a6":"Sì. Esporti e importi tutto in JSON (backup completo) e CSV (interoperabile). I dati sono tuoi — entrano ed escono quando vuoi.","faq.q7":"Posso già usarlo? Come accedo?","faq.a7":"Sì! Basta creare un account gratuito e iniziare — ci vuole un minuto. I tuoi dati sono cifrati end-to-end, nel tuo browser, fin dall'inizio.","faq.q8":"In quali lingue?","faq.a8":"Portoghese, inglese e italiano — e l'app funziona in qualsiasi paese e valuta.","ct.eyebrow":"Inizia ora","ct.h2":"Inizia ora. È gratis e privato.","ct.p":"Crea il tuo account in un minuto e inizia a organizzare il tuo patrimonio in qualsiasi valuta. Gratis, privato, senza carta.","ct.btn":"Crea account gratis","ct.legal":"Gratis, senza carta. I tuoi dati sono cifrati end-to-end — nemmeno noi possiamo leggerli.","ct.d1":"Scrivimi direttamente","ct.d2":"Domande, partnership, feedback","ct.r1":"Privato dal giorno 1","ct.r2":"I tuoi numeri sono tuoi — crittografia end-to-end","foot.tag":"Patrimonio multivaluta, privato e senza confini. Per chi vive, investe o si muove tra paesi e valute.","foot.legal":"Privacy per crittografia end-to-end · LGPD/GDPR","mm.fx":"Cambi illustrativi — in tempo reale nell'app.","nav.login":"Accedi"} };

  var els = [].slice.call(document.querySelectorAll("[data-i18n]")).map(function (el) {
    return { el: el, key: el.getAttribute("data-i18n"), pt: el.textContent };
  });

  var LABELS = { pt: "PT", en: "EN", it: "IT" };

  function apply(lang, persist) {
    var dict = I18N[lang];
    els.forEach(function (o) {
      o.el.textContent = (lang !== "pt" && dict && dict[o.key] != null) ? dict[o.key] : o.pt;
    });
    document.documentElement.lang = lang === "pt" ? "pt-BR" : lang;
    var cur = document.getElementById("langcur");
    if (cur) cur.textContent = LABELS[lang] || "PT";
    [].forEach.call(document.querySelectorAll(".langmenu button"), function (b) {
      b.setAttribute("aria-current", b.getAttribute("data-lang") === lang ? "true" : "false");
    });
    if (persist) { try { localStorage.setItem("nf_lang", lang); } catch (e) {} }
  }

  // Dropdown de idioma — abre/fecha + seleção.
  var drop = document.getElementById("langdrop");
  var lbtn = document.getElementById("langbtn");
  var menu = document.getElementById("langmenu");
  function closeMenu() { if (drop) drop.classList.remove("open"); if (menu) menu.hidden = true; if (lbtn) lbtn.setAttribute("aria-expanded", "false"); }
  function openMenu() { if (drop) drop.classList.add("open"); if (menu) menu.hidden = false; if (lbtn) lbtn.setAttribute("aria-expanded", "true"); }
  if (lbtn) lbtn.addEventListener("click", function (e) { e.stopPropagation(); (menu && menu.hidden) ? openMenu() : closeMenu(); });
  [].forEach.call(document.querySelectorAll(".langmenu button"), function (b) {
    b.addEventListener("click", function () { apply(b.getAttribute("data-lang"), true); closeMenu(); });
  });
  document.addEventListener("click", function (e) { if (drop && !drop.contains(e.target)) closeMenu(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });

  // Detecção: escolha salva > idioma do navegador (pt/en/it) > geo por localização > pt.
  function mapCountry(cc) {
    if (!cc) return null;
    cc = String(cc).toUpperCase();
    if (cc === "BR" || cc === "PT" || cc === "AO" || cc === "MZ") return "pt";
    if (cc === "IT") return "it";
    return "en";
  }
  var saved = null;
  try { saved = localStorage.getItem("nf_lang"); } catch (e) {}
  var nav2 = (navigator.language || "").slice(0, 2).toLowerCase();
  var navLang = (nav2 === "en" || nav2 === "it" || nav2 === "pt") ? nav2 : null;
  apply(saved || navLang || "pt", false); // render imediato; auto-detecção NÃO persiste
  if (!saved && !navLang) {
    // navegador ambíguo → refina pela localização (best-effort, não bloqueia nada)
    fetch("/api/geo").then(function (r) { return r.json(); }).then(function (d) {
      var lang = mapCountry(d && d.country), has = null;
      try { has = localStorage.getItem("nf_lang"); } catch (e) {}
      if (lang && !has) apply(lang, false);
    }).catch(function () {});
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
