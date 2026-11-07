/* CV web — interactions (vanilla JS, aucune dépendance).
   - thème clair/sombre, e-mail assemblé à la volée
   - apparitions au scroll + compteurs animés
   - cœur de réacteur cliquable
   - lettre de recommandation en visionneuse
   - popup « vous êtes humain·e » → révélation animée des mots-clés */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Choix « mots-clés » : mémorisé le temps de l'onglet seulement (sessionStorage),
  // pour que la popup revienne à chaque nouvelle visite.
  function session(key, value) {
    try {
      if (value === undefined) return sessionStorage.getItem(key);
      sessionStorage.setItem(key, value);
    } catch (e) { return null; }
  }
  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { return null; }
  }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function on(action, fn) {
    $$('[data-action="' + action + '"]').forEach(function (el) { el.addEventListener("click", fn); });
  }

  /* --- Thème ------------------------------------------------------------- */
  on("theme", function () {
    var dark = root.getAttribute("data-theme")
      ? root.getAttribute("data-theme") === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    var next = dark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    store("theme", next);
  });

  /* --- E-mail (assemblé côté client, absent du HTML) --------------------- */
  $$("[data-email-user]").forEach(function (a) {
    var rev = function (s) { return s.split("").reverse().join(""); };
    var addr = rev(a.getAttribute("data-email-user")) + "@" + rev(a.getAttribute("data-email-domain"));
    a.href = "mailto:" + addr;
    if (a.closest(".contact")) a.textContent = addr;
  });

  /* --- Apparitions + compteurs ------------------------------------------- */
  function countUp(el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    if (!target || reduceMotion) return;
    var fmt = new Intl.NumberFormat(root.lang);
    var t0 = performance.now(), dur = 1200;
    (function tick(now) {
      var p = Math.min(1, (now - t0) / dur);
      el.textContent = fmt.format(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("is-visible");
        $$("[data-count]", en.target).forEach(countUp);
        io.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    $$(".fade-in").forEach(function (el) { io.observe(el); });
  } else {
    $$(".fade-in").forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* --- Cœur de réacteur -------------------------------------------------- */
  var coreData = {};
  try { JSON.parse($("#core-data").textContent).forEach(function (s) { coreData[s.id] = s; }); } catch (e) {}
  var zoneLabels = {};
  $$(".core__zones .zone").forEach(function (z) {
    zoneLabels[z.className.replace(/.*zone--(\w+).*/, "$1")] = $(".zone__label", z).textContent.trim();
  });
  var detail = $("#core-detail"), pick = $("#core-pick");

  function selectSkill(id) {
    var s = coreData[id];
    if (!s) return;
    $$(".is-active").forEach(function (el) { el.classList.remove("is-active"); });
    $$('[data-skill="' + id + '"]').forEach(function (el) { el.classList.add("is-active"); });
    $$(".asm[data-skill]").forEach(function (el) {
      el.classList.toggle("is-dim", el.getAttribute("data-skill").split("-")[0] !== s.zone);
    });
    $(".core__detail-zone", detail).textContent = zoneLabels[s.zone] || "";
    $(".core__detail-name", detail).textContent = s.name;
    var text = $(".core__detail-text", detail);
    text.textContent = s.detail || "";
    text.hidden = !s.detail;
    var list = $(".core__detail-list", detail);
    list.innerHTML = "";
    s.used_in.forEach(function (u) {
      var li = document.createElement("li"), a = document.createElement("a");
      a.href = u.href || "#exp-" + u.id;
      a.textContent = u.title + (u.org ? " — " + u.org : "");
      li.appendChild(a); list.appendChild(li);
    });
    $(".core__detail-label", detail).hidden = !s.used_in.length;
    $(".core__detail-list", detail).hidden = !s.used_in.length;
    var repos = $(".core__detail-repos", detail), reposList = s.repos || [];
    repos.innerHTML = "";
    reposList.forEach(function (r) {
      var li = document.createElement("li"), a = document.createElement("a");
      a.href = r.url; a.textContent = r.name; a.rel = "noopener";
      li.appendChild(a); repos.appendChild(li);
    });
    $(".core__detail-repos-label", detail).hidden = !reposList.length;
    repos.hidden = !reposList.length;
    var empty = $(".core__detail-empty", detail);
    empty.hidden = !!(s.used_in.length || s.detail || reposList.length) || !empty.textContent.trim();
    detail.hidden = false; pick.hidden = true;
    // relance l'animation d'apparition
    detail.style.animation = "none"; void detail.offsetWidth; detail.style.animation = "";
  }
  $$("[data-skill]").forEach(function (el) {
    var id = el.getAttribute("data-skill");
    el.addEventListener("click", function () { selectSkill(id); });
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectSkill(id); }
    });
  });

  /* --- Chargement du cœur (animation d'arrivée) -------------------------- */
  // Comme une campagne de rechargement : le 1er assemblage arrive à une mauvaise
  // place, le contrôle échoue (✗), il est repositionné et validé (✓) ; le 2e
  // arrive directement ; puis tous les autres, de plus en plus vite, du centre
  // vers la périphérie. Une seule fois par visite ; instantané si l'utilisateur
  // préfère réduire les animations.
  var NS = "http://www.w3.org/2000/svg";
  var coreBox = $(".core"), coreSvg = $(".core__svg");
  var fuel = coreSvg ? $$(".asm[data-skill]", coreSvg) : [];

  var coreFullHooks = [];               // appelés quand le cœur est plein
  function coreFull() {
    coreBox.classList.add("is-critical");
    coreFullHooks.splice(0).forEach(function (fn) { fn(); });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function cell(g) {
    var r = $("rect", g);
    return { x: +r.getAttribute("x"), y: +r.getAttribute("y"), s: +r.getAttribute("width") };
  }
  function check(g, ok) {
    var c = cell(g), m = document.createElementNS(NS, "g");
    var dot = document.createElementNS(NS, "circle"), t = document.createElementNS(NS, "text");
    m.setAttribute("class", "asm__mark " + (ok ? "is-ok" : "is-ko"));
    dot.setAttribute("cx", c.x + c.s - 9); dot.setAttribute("cy", c.y + 9); dot.setAttribute("r", 8);
    t.setAttribute("x", c.x + c.s - 9); t.setAttribute("y", c.y + 9.5);
    t.textContent = ok ? "\u2713" : "\u2717";
    m.appendChild(dot); m.appendChild(t);
    g.appendChild(m);
    g.classList.add(ok ? "is-accept" : "is-reject");
    setTimeout(function () { m.remove(); g.classList.remove("is-accept", "is-reject"); }, ok ? 650 : 1000);
  }
  function lower(g, dx, dy, ms) {        // descente « machine de chargement »
    g.classList.remove("is-pending");
    return g.animate([
      { transform: "translate(" + dx + "px," + (dy - 140) + "px)", opacity: 0 },
      { transform: "translate(" + dx + "px," + dy + "px)", opacity: 1 }
    ], { duration: ms, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" }).finished;
  }
  function settle(g) {
    g.getAnimations().forEach(function (a) { a.cancel(); });
    g.classList.add("is-placed");
  }
  function loadCore() {
    var first = fuel[0], second = fuel[1], rest = fuel.slice(2);
    var a = cell(fuel[fuel.length - 1]), b = cell(first);   // mauvaise place : en périphérie
    var dx = a.x - b.x, dy = a.y - b.y;
    lower(first, dx, dy, 900)
      .then(function () { return wait(250); })
      .then(function () { check(first, false); return wait(950); })
      .then(function () {
        return first.animate([
          { transform: "translate(" + dx + "px," + dy + "px)" },
          { transform: "translate(0,0)" }
        ], { duration: 1100, easing: "cubic-bezier(.6,0,.3,1)", fill: "forwards" }).finished;
      })
      .then(function () { settle(first); check(first, true); return wait(700); })
      .then(function () { return second ? lower(second, 0, 0, 700) : null; })
      .then(function () {
        if (second) { settle(second); check(second, true); }
        return wait(600);
      })
      .then(function () {
        var t = 0, gap = 380;                 // intervalle de plus en plus court
        rest.forEach(function (g, i) {
          t += gap;
          gap = Math.max(22, gap * 0.8);
          setTimeout(function () {
            lower(g, 0, 0, Math.max(220, 520 - i * 15)).then(function () {
              settle(g);
              if (i === rest.length - 1) coreFull();
            });
          }, t);
        });
        if (!rest.length) coreFull();
      });
  }
  if (fuel.length > 1 && !reduceMotion && Element.prototype.animate && "IntersectionObserver" in window) {
    fuel.forEach(function (g) { g.classList.add("is-pending"); });
    var coreIO = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      coreIO.disconnect();
      loadCore();
    }, { threshold: 0.35 });
    coreIO.observe(coreSvg);
  } else {
    fuel.forEach(function (g) { g.classList.add("is-placed"); });
  }

  /* --- Lettre de recommandation ------------------------------------------ */
  var dialog = $("#letter-dialog"), letterImg = $(".lightbox__img");
  on("open-letter", function () {
    if (!letterImg.src) letterImg.src = letterImg.getAttribute("data-src");
    if (dialog.showModal) dialog.showModal(); else window.open(letterImg.getAttribute("data-src"));
  });
  on("close-letter", function () { dialog.close(); });
  if (dialog) {
    dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
    letterImg.addEventListener("click", function (e) {
      var box = letterImg.parentElement, rect = letterImg.getBoundingClientRect();
      var fx = (e.clientX - rect.left) / rect.width, fy = (e.clientY - rect.top) / rect.height;
      letterImg.classList.toggle("is-zoomed");
      box.scrollLeft = fx * box.scrollWidth - box.clientWidth / 2;
      box.scrollTop = fy * box.scrollHeight - box.clientHeight / 2;
    });
  }

  /* --- Mots-clés : révélation animée ------------------------------------- */
  // Étiquette sur 1 ou 2 lignes (≤ 10 caractères chacune) dans une case du cœur.
  function setLabel(text, word) {
    var max = 10, words = word.split(/\s+/), lines = [""];
    words.forEach(function (w) {
      var cur = lines[lines.length - 1];
      if (!cur) lines[lines.length - 1] = w;
      else if ((cur + " " + w).length <= max) lines[lines.length - 1] = cur + " " + w;
      else lines.push(w);
    });
    if (lines.length > 2) lines = [lines[0], lines.slice(1).join(" ")];
    lines = lines.map(function (l) { return l.length > max ? l.slice(0, max - 1) + "…" : l; });
    var x = text.getAttribute("x"), y = parseFloat(text.getAttribute("y"));
    text.textContent = "";
    lines.forEach(function (l, i) {
      var t = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      t.setAttribute("x", x);
      t.setAttribute("y", y + (i - (lines.length - 1) / 2) * 12);
      t.textContent = l;
      text.appendChild(t);
    });
  }
  var revealed = false;
  function revealKeywords(instant) {
    if (revealed) { $("#keywords").scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    revealed = true;
    hideToast();
    $$(".is-dim").forEach(function (el) { el.classList.remove("is-dim"); });
    var details = $("#keywords"), core = $(".core");
    details.open = true;
    var slots = $$(".asm--slot");
    var chips = {};
    $$(".kw", details).forEach(function (k) { chips[k.getAttribute("data-kw")] = k; });

    function load(slot, i) {
      var word = slot.getAttribute("data-slot");
      setLabel($("text", slot), word);
      var title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = word; slot.appendChild(title);
      slot.classList.add("is-loaded");
      slot.setAttribute("aria-label", word);
      if (i === slots.length - 1) core.classList.add("is-loaded");
    }

    if (instant === true || reduceMotion || !Element.prototype.animate) {
      slots.forEach(load);
      return;
    }
    $(".core__figure").scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(function () {
      slots.forEach(function (slot, i) {
        var chip = chips[slot.getAttribute("data-slot")];
        setTimeout(function () {
          if (!chip) { load(slot, i); return; }
          var from = chip.getBoundingClientRect(), to = $("rect", slot).getBoundingClientRect();
          var fly = document.createElement("span");
          fly.className = "flyer"; fly.textContent = chip.textContent;
          fly.style.left = from.left + "px"; fly.style.top = from.top + "px";
          document.body.appendChild(fly);
          chip.classList.add("is-flying");
          var dx = to.left + to.width / 2 - (from.left + from.width / 2);
          var dy = to.top + to.height / 2 - (from.top + from.height / 2);
          var anim = fly.animate([
            { transform: "translate(0,0) scale(1)", opacity: 1 },
            { transform: "translate(" + dx * 0.5 + "px," + (dy * 0.5 - 60) + "px) scale(1.1)", opacity: 1, offset: 0.5 },
            { transform: "translate(" + dx + "px," + dy + "px) scale(.35)", opacity: 0.2 }
          ], { duration: 900, easing: "cubic-bezier(.45,.05,.35,1)" });
          anim.onfinish = function () {
            fly.remove(); load(slot, i);
            chip.classList.remove("is-flying"); chip.classList.add("is-landed");
          };
        }, i * 70);
      });
    }, 650);
  }
  on("reveal-keywords", function () { revealKeywords(); });

  /* --- Détection « humain » ---------------------------------------------- */
  // Les agents IA lisent le HTML sans exécuter ce script : ils voient déjà le
  // panneau de mots-clés. Un visiteur qui reste ~12 s sur l'onglet visible ET
  // interagit (scroll, souris, clavier, toucher) est très probablement humain.
  // La popup revient à chaque visite ; un rechargement dans le même onglet
  // après « Afficher » recharge directement les mots-clés dans le cœur.
  var toast = $("#human-toast");
  var DWELL_SECONDS = 12;
  var seconds = 0, interacted = false, timer = null;
  function hideToast() { if (toast) toast.hidden = true; }
  function showToast() {
    if (revealed || !toast) return;
    toast.hidden = false;
    $("button", toast).focus({ preventScroll: true });
  }
  var choice = session("keywords-choice");
  try { localStorage.removeItem("keywords-choice"); } catch (e) {}  // ancien choix permanent
  if (choice === "shown") {
    // Rechargement dans le même onglet : mots-clés remis directement, après le
    // chargement des compétences s'il est encore animé.
    if ($(".asm.is-pending")) coreFullHooks.push(function () { revealKeywords(true); });
    else revealKeywords(true);
  }
  if (toast && !choice) {
    ["scroll", "pointermove", "keydown", "touchstart"].forEach(function (ev) {
      window.addEventListener(ev, function () { interacted = true; }, { passive: true, once: true });
    });
    timer = setInterval(function () {
      if (document.visibilityState !== "visible") return;
      seconds += 1;
      if (seconds >= DWELL_SECONDS && interacted) { clearInterval(timer); showToast(); }
    }, 1000);
  }
  on("toast-yes", function () { session("keywords-choice", "shown"); revealKeywords(); });
  on("toast-no", function () { session("keywords-choice", "dismissed"); hideToast(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hideToast(); });
})();
