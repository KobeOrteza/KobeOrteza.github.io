/* ai-builder.js — a swarm of AI "agent cursors" that build each section as you scroll.
   • Several agents (architect, stylist, logic, motion) claim components from a shared queue.
   • Each agent has its own colour, trail, build beam and mini code panel.
   • Desktop: progress is scrubbed by scroll (scroll up = un-build).
   • Mobile:  sections build once on enter, no agent cursors.
   • Reduced motion: everything is shown already built. */
(() => {
  "use strict";
  const KOBE = window.KOBE || {};
  if (KOBE.reduceMotion) return;

  const sections = [...document.querySelectorAll("[data-build]")];
  if (!sections.length) return;

  const layer = document.getElementById("agents");
  const canvas = document.getElementById("builder-canvas");
  const ctx = canvas ? canvas.getContext("2d") : null;
  const logEl = document.getElementById("build-log");
  const pctEl = document.getElementById("build-pct");
  const barEl = document.getElementById("build-bar");
  const metaEl = document.getElementById("build-meta");
  const linesEl = document.getElementById("build-lines");
  const rosterEl = document.getElementById("agent-roster");
  const toastsEl = document.getElementById("toasts");
  const footerEl = document.getElementById("footer-build");

  /* ---------- The crew ---------- */
  const AGENTS = [
    { id: "kobe.ai", role: "architect", rgb: "87,216,206", idle: ["planning layout", "reviewing PR", "orchestrating"] },
    { id: "pixel.agent", role: "styles", rgb: "224,144,79", idle: ["tuning gradients", "kerning type", "polishing shadows"] },
    { id: "neuron.agent", role: "logic", rgb: "155,140,255", idle: ["running tests", "linting", "type-checking"] },
    { id: "vector.agent", role: "motion", rgb: "255,111,181", idle: ["easing curves", "timing keyframes", "profiling 60fps"] }
  ];

  /* ---------- What gets built, and how ---------- */
  const RULES = [
    [".stat", "wire", 40],
    [".section-eyebrow", "wire", 0],
    [".section-head h2", "type", 0],
    [".section-head p", "wire", 0],
    [".project-card", "wire", 0],
    [".project-topline", "wire", 0],
    [".project-icon", "wire", 0],
    [".project-info h3", "type", 0],
    [".project-info h4", "wire", 0],
    [".project-info > p", "wire", 0],
    [".case", "wire", 0],
    [".chips li", "wire", 16],
    [".project-link", "wire", 0],
    [".project-visual", "wire", 0],
    [".focus-card", "wire", 40],
    [".focus-card h3", "type", 40],
    [".constellation-wrap", "wire", 0],
    [".skill-group", "wire", 30],
    [".skill-group li", "wire", 10],
    [".achievement-feature", "wire", 0],
    [".achievement-feature h3", "type", 0],
    [".achievement-item", "wire", 0],
    [".other-grid li", "wire", 14],
    [".hardware-panel", "wire", 0],
    [".hardware-info h3", "type", 0],
    [".specs span", "wire", 0],
    [".about-box", "wire", 0],
    [".about-copy h3", "type", 0],
    [".mini-terminal", "wire", 0],
    [".interest-list > div", "wire", 0],
    [".profile-grid > span", "wire", 30],
    [".contact-card", "wire", 0],
    [".contact-card h2", "type", 0],
    [".contact-link", "wire", 0]
  ];

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const selectorOf = (el) => {
    const cls = [...el.classList].filter((c) => !/^(bt|tilt-card|magnetic|featured|reverse|cyan|copper|just-built|glitch-once|reveal)/.test(c))[0];
    return cls ? `${el.tagName.toLowerCase()}.${cls}` : el.tagName.toLowerCase();
  };

  /* Split a heading into per-character spans (keeps nested elements like <br>, <span>) */
  const splitChars = (root) => {
    const chars = [];
    let pendingSpace = false;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); pendingSpace = chars.length > 0; return; }
            const word = document.createElement("span");
            word.className = "word";
            for (const ch of part) {
              const s = document.createElement("span");
              s.className = "ch";
              s.textContent = ch;
              s.dataset.t = (pendingSpace ? " " : "") + ch;
              pendingSpace = false;
              word.appendChild(s);
              chars.push(s);
            }
            frag.appendChild(word);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName === "BR") {
          pendingSpace = chars.length > 0;
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    };
    walk(root);
    return chars;
  };

  /* ---------- Collect targets ---------- */
  const targets = [];
  const seen = new Set();
  sections.forEach((section, sIdx) => {
    RULES.forEach(([sel, kind, stagger]) => {
      section.querySelectorAll(sel).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        const siblings = el.parentElement ? [...el.parentElement.children].filter((c) => c.matches(sel)) : [el];
        targets.push({
          el, kind, section: sIdx,
          stagger: stagger * Math.max(0, siblings.indexOf(el)),
          state: -1, lp: 0, maxLp: 0, builtAt: 0,
          name: el.dataset.name || null,
          sel: selectorOf(el),
          chars: null, shown: -1, info: null, rect: null, agent: null
        });
      });
    });
  });
  targets.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  targets.forEach((t, i) => {
    t.index = i;
    t.el.classList.add("bt");
    if (t.kind === "type") {
      t.el.classList.add("bt-type");
      t.el.setAttribute("aria-label", t.el.textContent.replace(/\s+/g, " ").trim());
      t.chars = splitChars(t.el);
    }
  });
  document.documentElement.classList.add("builder-on");

  const sectionInfo = sections.map((s) => ({
    el: s,
    name: s.dataset.build,
    total: targets.filter((t) => t.el.closest("[data-build]") === s).length,
    built: 0, done: false, deployedAt: 0
  }));

  /* ---------- Agent DOM ---------- */
  const agents = AGENTS.map((a, i) => {
    const el = document.createElement("div");
    el.className = "agent";
    el.style.setProperty("--c", `rgb(${a.rgb})`);
    el.style.setProperty("--c-soft", `rgba(${a.rgb},.35)`);
    el.innerHTML = `
      <svg viewBox="0 0 24 24" class="agent-arrow"><path d="M3 2l7.5 19 2.6-7.9L21 10.5z"/></svg>
      <span class="agent-stack"><span class="agent-tag"><i></i><b>${a.id}</b><em></em></span>
      <pre class="agent-code"></pre></span>`;
    if (layer) layer.appendChild(el);
    return {
      ...a, i, el,
      tagEm: el.querySelector(".agent-tag em"),
      codeEl: el.querySelector(".agent-code"),
      arrow: el.querySelector(".agent-arrow"),
      tagWrap: el.querySelector(".agent-stack"),
      tagDy: 0, tagDyShown: 0,
      x: innerWidth * (0.3 + i * 0.12), y: innerHeight + 60, tx: innerWidth * 0.5, ty: innerHeight * 0.5,
      vx: 0, vy: 0, rot: 0, built: 0,
      target: null, trail: [], status: "booting", lastCode: "", lastStatus: "",
      idleSeed: Math.random() * 100, idleText: a.idle[0], idleSwap: 0
    };
  });

  if (rosterEl) {
    rosterEl.innerHTML = agents.map((a) =>
      `<li style="--c:rgb(${a.rgb})"><i></i><b>${a.id}</b><span data-agent-status="${a.i}">booting</span></li>`).join("");
  }
  const rosterStatus = agents.map((a) => rosterEl && rosterEl.querySelector(`[data-agent-status="${a.i}"]`));

  /* ---------- UI helpers ---------- */
  const log = (html) => {
    if (!linesEl) return;
    const li = document.createElement("li");
    li.innerHTML = html;
    linesEl.prepend(li);
    while (linesEl.children.length > 4) linesEl.lastChild.remove();
  };
  let lastToast = 0;
  const toast = (html, rgb, force) => {
    if (!toastsEl) return;
    const now = performance.now();
    if (!force && now - lastToast < 450) return;
    lastToast = now;
    const el = document.createElement("div");
    el.className = "toast";
    if (rgb) el.style.setProperty("--c", `rgb(${rgb})`);
    el.innerHTML = html;
    toastsEl.appendChild(el);
    while (toastsEl.children.length > 3) toastsEl.firstChild.remove();
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 450); }, 2600);
  };

  const describe = (t) => {
    if (t.info) return t.info;
    const cs = getComputedStyle(t.el);
    const r = t.el.getBoundingClientRect();
    const cls = t.sel.split(".")[1] || "";
    const lines = [`<span class="k">&lt;${t.el.tagName.toLowerCase()}</span>${cls ? ` <span class="m">.</span><span class="s">${esc(cls)}</span>` : ""}<span class="k">&gt;</span>`];
    lines.push(`  ${cs.display} · <span class="s">${Math.round(r.width)}×${Math.round(r.height)}</span>`);
    if (cs.borderRadius && cs.borderRadius !== "0px") lines.push(`  radius <span class="s">${cs.borderRadius.split(" ")[0]}</span>`);
    t.info = lines.join("\n");
    return t.info;
  };

  /* ---------- Loop state ---------- */
  const mobile = () => KOBE.isSmall() || KOBE.isTouch;
  let W = innerWidth, H = innerHeight, dpr = 1;
  const resize = () => {
    W = innerWidth; H = innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, mobile() ? 1.5 : 2);
    if (canvas) {
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    targets.forEach((t) => { t.info = null; });
  };
  window.addEventListener("resize", resize, { passive: true });
  resize();
  let maxScroll = 1;
  const measureMax = () => { maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight); };
  measureMax();
  window.addEventListener("resize", measureMax, { passive: true });
  window.addEventListener("load", measureMax);
  if ("ResizeObserver" in window) new ResizeObserver(measureMax).observe(document.body);

  let builtCount = 0;
  let allDone = false;
  const sparks = []; // little particles agents emit when they finish a component

  const perimeterPoint = (r, p) => {
    let d = p * 2 * (r.width + r.height);
    if (d <= r.width) return [r.left + d, r.top];
    d -= r.width;
    if (d <= r.height) return [r.right, r.top + d];
    d -= r.height;
    if (d <= r.width) return [r.right - d, r.bottom];
    d -= r.width;
    return [r.left, r.bottom - d];
  };

  const drawFrame = (r, p, label, rgb, now, flash) => {
    const per = 2 * (r.width + r.height);
    ctx.save();
    if (!flash) {
      // blueprint fill with a faint grid
      ctx.fillStyle = `rgba(${rgb},${0.025 + 0.035 * p})`;
      ctx.fillRect(r.left, r.top, r.width, r.height);
      if (r.width > 80 && r.height > 50) {
        ctx.strokeStyle = `rgba(${rgb},.06)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = r.left + 24; x < r.right; x += 24) { ctx.moveTo(x, r.top); ctx.lineTo(x, r.bottom); }
        for (let y = r.top + 24; y < r.bottom; y += 24) { ctx.moveTo(r.left, y); ctx.lineTo(r.right, y); }
        ctx.stroke();
      }
    }
    ctx.strokeStyle = flash ? `rgba(255,255,255,${flash})` : `rgba(${rgb},.9)`;
    ctx.shadowColor = `rgba(${rgb},.8)`;
    ctx.shadowBlur = flash ? 14 : 6;
    ctx.lineWidth = flash ? 1.6 : 1.1;
    ctx.setLineDash(flash ? [] : [6, 4]);
    ctx.lineDashOffset = -now / 35;
    ctx.beginPath();
    ctx.moveTo(r.left, r.top);
    const corners = [[r.right, r.top], [r.right, r.bottom], [r.left, r.bottom], [r.left, r.top]];
    const segs = [r.width, r.height, r.width, r.height];
    let rem = flash ? per : Math.min(1, p) * per;
    let px = r.left, py = r.top;
    for (let i = 0; i < 4 && rem > 0; i++) {
      const s = Math.min(rem, segs[i]);
      const f = s / segs[i];
      ctx.lineTo(px + (corners[i][0] - px) * f, py + (corners[i][1] - py) * f);
      rem -= s;
      [px, py] = corners[i];
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (!flash) {
      ctx.setLineDash([]);
      ctx.strokeStyle = `rgba(${rgb},1)`;
      ctx.lineWidth = 2;
      const b = Math.min(12, r.width / 4, r.height / 4);
      [[r.left, r.top, 1, 1], [r.right, r.top, -1, 1], [r.right, r.bottom, -1, -1], [r.left, r.bottom, 1, -1]].forEach(([x, y, sx, sy]) => {
        ctx.beginPath(); ctx.moveTo(x + b * sx, y); ctx.lineTo(x, y); ctx.lineTo(x, y + b * sy); ctx.stroke();
      });
      if (r.width > 60 && r.height > 18) {
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.fillStyle = `rgba(${rgb},1)`;
        ctx.fillText(`<${label}>`, r.left + 2, r.top - 6);
        const dims = `${Math.round(r.width)} × ${Math.round(r.height)} · ${Math.round(Math.min(1, p) * 100)}%`;
        ctx.fillStyle = "rgba(220,230,240,.6)";
        ctx.fillText(dims, r.right - ctx.measureText(dims).width - 2, r.top - 6);
      }
    }
    ctx.restore();
  };

  /* ---------- Main loop ---------- */
  let lastNow = 0;
  let arriveAt = Infinity;
  if (KOBE.onBoot) KOBE.onBoot(() => { arriveAt = performance.now() + 1200; });
  const tick = (now) => {
    requestAnimationFrame(tick);
    if (document.hidden) { lastNow = 0; return; }
    const f = lastNow ? Math.min(3, (now - lastNow) / 16.667) : 1; // frame-rate independent physics
    lastNow = now;
    const isMobile = mobile();
    const sy = window.scrollY;
    // Build band in the MIDDLE of the screen: a component starts building when its top
    // reaches ~68% of the viewport and is finished by ~42% — right where people look.
    const bandStart = H * (isMobile ? 0.8 : 0.68);
    const bandEnd = H * (isMobile ? 0.4 : 0.42);
    const lim = maxScroll - Math.max(48, H * 0.07); // finish a little before the very bottom

    // 1) READ — measure everything first (avoids layout thrash)
    for (const t of targets) {
      const r = t.el.getBoundingClientRect();
      t.rect = r;
      // work in scroll positions: s0 = scrollY where the build starts, s1 = where it ends
      const docTop = r.top + sy - (t.offsetY || 0) + t.stagger;
      const extra = t.kind === "type" ? H * 0.05 : 0;
      let s0 = docTop - bandStart - extra, s1 = docTop - bandEnd;
      if (docTop < H * 0.9) { s0 = -2; s1 = -1; }               // visible at load → already built
      else if (s1 > lim) {                                         // near the page end: the band can't be
        const len = Math.max(H * 0.14, (s1 - s0) * 0.6);           // reached, so compress the build into
        s1 = lim;                                                  // the last stretch of scroll
        s0 = Math.min(s0, s1 - len);
      }
      t.lp = Math.max(0, Math.min(1, (sy - s0) / Math.max(1, s1 - s0)));
    }

    // 2) WRITE — update build states
    const active = [];
    for (const t of targets) {
      const lp = t.lp;
      if (t.kind === "type") {
        const n = t.chars.length;
        const on = Math.round(lp * n);
        if (on !== t.shown) {
          const prev = Math.max(0, t.shown);
          if (on > prev) { for (let i = prev; i < on; i++) t.chars[i].classList.add("on"); if (t.shown >= 0) KOBE.sfx && KOBE.sfx("type"); }
          else for (let i = on; i < prev; i++) t.chars[i].classList.remove("on");
          t.chars.forEach((c) => c.classList.remove("caret"));
          if (on > 0 && on < n) t.chars[on - 1].classList.add("caret");
          if (on >= n && t.shown < n && t.shown >= 0 && t.el.matches(".section-head h2")) {
            t.el.classList.remove("glitch-once");
            void t.el.offsetWidth;
            t.el.classList.add("glitch-once");
            KOBE.sfx && KOBE.sfx("glitch");
          }
          t.shown = on;
        }
        const state = on >= n ? 2 : on > 0 ? 1 : 0;
        if (state !== t.state) {
          if (state === 2) onBuilt(t, t.state === -1, now); else if (t.state === 2) onUnbuilt(t);
          t.state = state;
        }
      } else {
        const state = lp >= 1 ? 2 : lp > 0 ? 1 : 0;
        // Continuous reveal, scrubbed by scroll: fade + rise + a top-down "render" clip
        // that fills in while the agent traces the outline. No pops, no thresholds.
        const q = Math.round(lp * 250) / 250;
        if (q !== t.q) {
          t.q = q;
          const st = t.el.style;
          if (q >= 1) {
            t.offsetY = 0;
            st.opacity = ""; st.transform = ""; st.clipPath = ""; st.pointerEvents = "";
          } else if (q <= 0) {
            t.offsetY = 16;
            st.opacity = "0"; st.transform = "translateY(16px)"; st.clipPath = ""; st.pointerEvents = "none";
          } else {
            const e = 1 - Math.pow(1 - q, 3);
            const fill = Math.min(1, Math.max(0, (q - 0.1) / 0.82));
            t.offsetY = (1 - e) * 16;
            st.opacity = (0.1 + 0.9 * Math.min(1, q * 1.5)).toFixed(3);
            st.transform = `translateY(${t.offsetY.toFixed(2)}px)`;
            st.clipPath = `inset(-3px -3px ${((1 - fill) * 100).toFixed(2)}% -3px)`;
            st.pointerEvents = "none";
          }
        }
        if (state !== t.state) {
          t.el.classList.toggle("bt-built", state === 2);
          if (state === 2 && t.state !== -1) t.builtAt = now;
          if (state === 2) onBuilt(t, t.state === -1, now); else if (t.state === 2) onUnbuilt(t);
          t.state = state;
        }
      }
      if (lp > 0 && lp < 1 && t.rect.bottom > 0 && t.rect.top < H) active.push(t);
    }

    updateProgress();
    if (!layer || !ctx) return;

    // 3) Assign work: agents keep their current job if it's still in progress,
    //    otherwise grab the earliest unclaimed component.
    const claimed = new Set();
    agents.forEach((a) => {
      if (a.target && active.includes(a.target)) claimed.add(a.target);
      else a.target = null;
    });
    agents.forEach((a) => {
      if (a.target) return;
      const job = active.find((t) => !claimed.has(t));
      if (job) { a.target = job; claimed.add(job); job.agent = a; KOBE.sfx && KOBE.sfx("claim", { agent: a.i }); }
    });

    ctx.clearRect(0, 0, W, H);

    // section deploy sweeps
    sectionInfo.forEach((s) => {
      if (!s.deployedAt || now - s.deployedAt > 900) return;
      const r = s.el.getBoundingClientRect();
      const p = (now - s.deployedAt) / 900;
      const y = r.top + (r.height) * p;
      if (y < -20 || y > H + 20) return;
      const g = ctx.createLinearGradient(0, y - 60, 0, y);
      g.addColorStop(0, "rgba(87,216,206,0)");
      g.addColorStop(1, `rgba(87,216,206,${0.18 * (1 - p)})`);
      ctx.fillStyle = g;
      ctx.fillRect(r.left, y - 60, r.width, 60);
      ctx.fillStyle = `rgba(205,255,250,${0.9 * (1 - p)})`;
      ctx.fillRect(r.left, y, r.width, 1.5);
    });

    // wireframes for everything mid-build, in the colour of the agent working on it
    for (const t of targets) {
      const r = t.rect;
      if (r.bottom < -40 || r.top > H + 40) continue;
      const owner = agents.find((a) => a.target === t);
      const rgb = owner ? owner.rgb : "87,216,206";
      if (t.kind === "wire" && t.lp > 0 && t.lp < 1) drawFrame(r, t.lp * 1.15, t.sel, rgb, now, 0);
      else if (t.builtAt && now - t.builtAt < 450) drawFrame(r, 1, t.sel, (t.agent || agents[0]).rgb, now, (1 - (now - t.builtAt) / 450) * 0.9);
    }

    // 4) Move agents
    const lead = agents[0];
    const nextUnbuilt = targets.find((t) => t.state < 2);
    const atTop = window.scrollY < H * 0.3;
    const holo = document.getElementById("holo-frame");
    const stageEl = document.getElementById("holo-stage");
    agents.forEach((a) => {
      let status, code = "";
      const t = a.target;
      if (t) {
        const r = t.rect;
        if (t.kind === "type") {
          const ch = t.chars[Math.max(0, t.shown - 1)];
          const cr = ch && ch.getBoundingClientRect();
          if (cr) { a.tx = cr.right + 2; a.ty = cr.top + cr.height * 0.65; }
          status = `writing <${t.el.tagName.toLowerCase()}>`;
          const typed = t.chars.slice(0, t.shown).map((c) => c.dataset.t).join("");
          code = `<span class="k">&lt;${t.el.tagName.toLowerCase()}&gt;</span>\n  ${esc(typed.slice(-34))}`;
        } else {
          const [px, py] = perimeterPoint(r, Math.min(1, t.lp * 1.15));
          a.tx = px; a.ty = py;
          status = `rendering .${t.sel.split(".")[1] || t.sel}`;
          code = describe(t);
        }
      } else {
        // idle behaviour
        if (now > a.idleSwap) { a.idleText = a.idle[(Math.random() * a.idle.length) | 0]; a.idleSwap = now + 2500 + Math.random() * 2500; }
        const wob = now / 900 + a.idleSeed;
        if (!nextUnbuilt) {
          // build complete: agents gather bottom-right in a little formation
          a.tx = W - 160 - (a.i % 2) * 70 + Math.sin(wob) * 8;
          a.ty = H - 200 + Math.floor(a.i / 2) * 46 + Math.cos(wob) * 6;
          status = a.i === 0 ? "build complete ✓" : "standing by";
        } else if (atTop && holo) {
          // on the hero, the crew orbits the hologram, "scanning" it
          const hr = holo.getBoundingClientRect();
          const ang = now / 2600 + a.i * (Math.PI / 2);
          a.tx = hr.left + hr.width / 2 + Math.cos(ang) * hr.width * 0.5;
          a.ty = hr.top + hr.height * 0.42 + Math.sin(ang) * hr.height * 0.46;
          // stay inside the hologram's column so tags never cover the headline
          const sr = stageEl ? stageEl.getBoundingClientRect() : hr;
          if (W > 1080) a.tx = Math.max(sr.left + 70, Math.min(sr.right - 160, a.tx));
          status = a.i === 0 ? "scroll ↓ we'll build the rest" : ["scanning face mesh", "sampling bits", "calibrating beam"][a.i - 1];
        } else if (a !== lead && lead.target) {
          // support the lead: orbit near it
          const ang = wob * 0.8 + a.i * 2.1;
          a.tx = lead.x + Math.cos(ang) * (90 + a.i * 18);
          a.ty = lead.y + Math.sin(ang) * (60 + a.i * 10);
          status = a.idleText;
        } else {
          const r = nextUnbuilt.rect;
          a.tx = Math.min(W - 80, Math.max(40, r.left + 40 + a.i * 60)) + Math.sin(wob) * 10;
          a.ty = Math.min(H - 80, Math.max(90, Math.min(r.top, H - 90) - 40 - a.i * 14)) + Math.cos(wob) * 8;
          status = a.i === 0 ? "waiting for scroll…" : a.idleText;
        }
      }

      if (!t) { a.tx = Math.min(W - 60, Math.max(30, a.tx)); a.ty = Math.min(H - 90, Math.max(80, a.ty)); }
      // hero choreography: the crew waits off-screen, then flies in one by one
      if (now < arriveAt + a.i * 170) {
        a.x = W * 0.5 + (a.i - 1.5) * 70; a.y = H + 50; a.vx = a.vy = 0; a.trail.length = 0;
      }
      // critically-damped-ish spring: smooth glide, no jitter, settles cleanly
      const k = (t ? 0.1 : 0.026) * f;
      const damp = Math.pow(t ? 0.74 : 0.87, f);
      const gx = a.tx - a.x, gy = a.ty - a.y;
      const gd = Math.hypot(gx, gy);
      // long trips bow into a gentle arc (alternating sides per agent) instead of a straight snap
      const arc = gd > 70 ? Math.min(gd, 320) * 0.0045 * f * (a.i % 2 ? 1 : -1) / gd : 0;
      a.vx = (a.vx + gx * k - gy * arc * gd * 0.02) * damp;
      a.vy = (a.vy + gy * k + gx * arc * gd * 0.02) * damp;
      const sp = Math.hypot(a.vx, a.vy), maxV = (t ? 38 : 14) * f;
      if (sp > maxV) { a.vx *= maxV / sp; a.vy *= maxV / sp; }
      a.x += a.vx * f;
      a.y += a.vy * f;
      a.rot += (Math.max(-16, Math.min(16, a.vx * 1.4)) - a.rot) * Math.min(1, 0.18 * f);
      const lastP = a.trail[a.trail.length - 1];
      if (!lastP || Math.hypot(lastP[0] - a.x, lastP[1] - a.y) > 1.2) {
        a.trail.push([a.x, a.y]);
        if (a.trail.length > 22) a.trail.shift();
      } else if (a.trail.length > 2) a.trail.shift(); // trail retracts while resting

      a.el.style.transform = `translate3d(${(a.x - 3).toFixed(2)}px, ${(a.y - 2).toFixed(2)}px, 0)`;
      a.arrow.style.transform = `rotate(${a.rot.toFixed(2)}deg)`;
      a.el.classList.toggle("is-on", KOBE.booted && now > arriveAt + a.i * 170);
      a.el.classList.toggle("is-working", !!t);
      // only the lead and whoever is typing show a code bubble (keeps the swarm readable)
      a.el.classList.toggle("show-code", !!t && (a.i === 0 || t.kind === "type"));
      a.el.classList.toggle("flip", a.x > W - Math.min(300, W * 0.48));
      if (status !== a.lastStatus) {
        a.tagEm.textContent = status;
        if (rosterStatus[a.i]) rosterStatus[a.i].textContent = status;
        a.lastStatus = status;
      }
      if (code !== a.lastCode) { a.codeEl.innerHTML = code; a.lastCode = code; }

      // smooth tapered comet trail (quadratic curves through midpoints)
      const tr = a.trail;
      ctx.lineCap = "round";
      for (let k = 1; k < tr.length - 1; k++) {
        const q = k / tr.length;
        const m0x = (tr[k - 1][0] + tr[k][0]) / 2, m0y = (tr[k - 1][1] + tr[k][1]) / 2;
        const m1x = (tr[k][0] + tr[k + 1][0]) / 2, m1y = (tr[k][1] + tr[k + 1][1]) / 2;
        ctx.strokeStyle = `rgba(${a.rgb},${q * q * 0.6})`;
        ctx.lineWidth = q * 3.2;
        ctx.beginPath();
        ctx.moveTo(m0x, m0y);
        ctx.quadraticCurveTo(tr[k][0], tr[k][1], m1x, m1y);
        ctx.stroke();
      }
      // build beam: a soft curved link into the component with energy dots flowing along it
      if (t && t.kind === "wire") {
        const r = t.rect;
        const cx = r.left + r.width / 2, cy = r.top + Math.min(r.height / 2, 80);
        const mx = (a.x + cx) / 2, my = Math.min(a.y, cy) - 40;
        const g = ctx.createLinearGradient(a.x, a.y, cx, cy);
        g.addColorStop(0, `rgba(${a.rgb},.5)`);
        g.addColorStop(1, `rgba(${a.rgb},0)`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, cx, cy); ctx.stroke();
        for (let d = 0; d < 3; d++) {
          const u = ((now / 900) + d / 3) % 1, iu = 1 - u;
          const bx = iu * iu * a.x + 2 * iu * u * mx + u * u * cx;
          const by = iu * iu * a.y + 2 * iu * u * my + u * u * cy;
          ctx.fillStyle = `rgba(${a.rgb},${0.9 * iu})`;
          ctx.beginPath(); ctx.arc(bx, by, 1.8 * iu + 0.4, 0, 6.28); ctx.fill();
        }
      }
    });

    // keep name tags from overlapping: stack any tags that collide, easing into place
    const order = agents.slice().sort((p, q) => p.y - q.y);
    order.forEach((a, idx) => {
      let dy = 0;
      for (let j = 0; j < idx; j++) {
        const b = order[j];
        if (Math.abs(a.x - b.x) < (W < 600 ? 120 : 190) && Math.abs((a.y + dy) - (b.y + b.tagDy)) < 26) dy = b.y + b.tagDy + 26 - a.y;
      }
      a.tagDy += (dy - a.tagDy) * Math.min(1, 0.2 * f);
      const v = Math.round(a.tagDy * 2) / 2;
      if (v !== a.tagDyShown) { a.tagDyShown = v; a.tagWrap.style.translate = `0 ${v}px`; }
    });

    // team links between agents (a little neural mesh)
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const A = agents[i], B = agents[j];
        const d = Math.hypot(A.x - B.x, A.y - B.y);
        if (d > 320 || i !== 0) continue; // only lead ↔ crew links: clean, readable
        const al = (1 - d / 320);
        ctx.strokeStyle = `rgba(200,220,235,${al * 0.08})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
        const p = ((now / 1600) + j * 0.33) % 1;
        ctx.fillStyle = `rgba(${B.rgb},${al * 0.7})`;
        ctx.beginPath(); ctx.arc(A.x + (B.x - A.x) * p, A.y + (B.y - A.y) * p, 1.4, 0, 6.28); ctx.fill();
      }
    }

    // completion sparks
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life -= 0.03;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      s.x += s.vx; s.y += s.vy; s.vx *= 0.94; s.vy *= 0.94;
      ctx.fillStyle = `rgba(${s.rgb},${s.life})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, 1.6 * s.life + 0.4, 0, 6.28); ctx.fill();
    }
  };

  function burst(x, y, rgb) {
    for (let i = 0; i < 14 && sparks.length < 160; i++) {
      const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 3;
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, rgb });
    }
  }

  function onBuilt(t, silent, now) {
    builtCount++;
    const sec = sectionInfo[t.section];
    sec.built++;
    if (silent) return;
    const who = agents.find((a) => a.target === t) || t.agent || agents[(t.index * 7) % agents.length];
    t.agent = who;
    if (t.rect) burst(t.rect.right, t.rect.top, who.rgb);
    who.built++;
    KOBE.sfx && KOBE.sfx("build", { agent: who.i, step: who.built % 5 });
    if (t.name) {
      log(`<b style="color:rgb(${who.rgb})">✓</b> ${t.name}.tsx <em>${Math.round(120 + Math.random() * 280)}ms</em>`);
    } else if (Math.random() < 0.3) {
      log(`<b style="color:rgb(${who.rgb})">+</b> ${esc(t.sel)}`);
    }
    if (!sec.done && sec.built >= sec.total) {
      sec.done = true;
      sec.deployedAt = now || performance.now();
      toast(`<b>⬢</b> crew deployed ${sec.name}`, "87,216,206", true);
      log(`<b>⬢</b> deployed ${sec.name}`);
      KOBE.sfx && KOBE.sfx("deploy");
    }
  }
  function onUnbuilt(t) {
    builtCount--;
    const sec = sectionInfo[t.section];
    sec.built--;
    if (sec.done && sec.built < sec.total) sec.done = false;
  }

  let lastPct = -1;
  function updateProgress() {
    const pct = Math.round((builtCount / targets.length) * 100);
    if (pct === lastPct) return;
    lastPct = pct;
    const mods = sectionInfo.filter((s) => s.done).length;
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (barEl) barEl.style.width = `${pct}%`;
    if (metaEl) metaEl.textContent = `${mods}/${sectionInfo.length} modules · ${builtCount}/${targets.length} components · ${agents.length} agents`;
    if (logEl) logEl.classList.toggle("done", pct >= 100);
    KOBE.buildPct = pct;
    if (pct >= 100 && !allDone) {
      allDone = true;
      toast("<b>✓</b> portfolio compiled · 4 agents · 0 errors", "87,216,206", true);
      KOBE.sfx && KOBE.sfx("complete");
      log("<b>✓</b> build complete");
      if (footerEl) footerEl.textContent = "Built live by the kobe.ai crew — 100% compiled";
    } else if (pct < 100) allDone = false;
  }

  const startLoop = () => requestAnimationFrame(tick);
  if (KOBE.onBoot) KOBE.onBoot(startLoop); else startLoop();

  // the build log only shows once you've left the hero
  const syncLog = () => logEl && logEl.classList.toggle("is-on", KOBE.booted && window.scrollY > H * 0.35);
  window.addEventListener("scroll", syncLog, { passive: true });
  if (KOBE.onBoot) KOBE.onBoot(syncLog);
})();
