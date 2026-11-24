/* effects.js — skill constellation, self-drawing timeline, cursor particle trail, audio EQ */
(() => {
  "use strict";
  const KOBE = window.KOBE || {};
  const reduceMotion = !!KOBE.reduceMotion;

  /* Run a canvas animation only while it is on screen */
  const whileVisible = (el, frameFn) => {
    let visible = false, raf = 0;
    const loop = (now) => {
      raf = 0;
      if (!visible || document.hidden) return;
      frameFn(now);
      raf = requestAnimationFrame(loop);
    };
    const kick = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop); };
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }).observe(el);
    } else { visible = true; kick(); }
    document.addEventListener("visibilitychange", kick);
  };

  const fitCanvas = (canvas, maxDpr = 2) => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    canvas.width = Math.max(1, Math.floor(r.width * dpr));
    canvas.height = Math.max(1, Math.floor(r.height * dpr));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: r.width, h: r.height };
  };

  /* ================= Skill constellation ================= */
  const cv = document.getElementById("constellation");
  if (cv) {
    const groups = [...document.querySelectorAll(".skill-group")].map((g) => ({
      el: g,
      name: g.querySelector("h3").textContent,
      skills: [...g.querySelectorAll("li")].map((li) => li.textContent)
    }));
    const COLORS = ["87,216,206", "224,144,79", "160,200,255", "87,216,206", "224,144,79", "190,240,235"];
    let ctx, w, h, nodes = [], hubs = [];
    let lit = -1;
    const pointer = { x: -999, y: -999 };

    const layout = () => {
      ({ ctx, w, h } = fitCanvas(cv));
      nodes = []; hubs = [];
      const cx = w / 2, cy = h / 2;
      const Rx = Math.min(w * 0.36, 420);
      const Ry = h * 0.27;
      const k = Math.min(1, h / 420);
      groups.forEach((g, gi) => {
        const ang = (gi / groups.length) * Math.PI * 2 - Math.PI / 2;
        const hub = { x: cx + Math.cos(ang) * Rx, y: cy + Math.sin(ang) * Ry, gi, label: g.name, ang };
        hubs.push(hub);
        const spread = Math.min(0.5, 2.6 / g.skills.length);
        g.skills.forEach((s, si) => {
          const a = ang + ((si - (g.skills.length - 1) / 2) * spread);
          const rr = (40 + (si % 2) * 22) * k;
          nodes.push({ gi, label: s, baseA: a, r: rr, hub, x: hub.x, y: hub.y, phase: Math.random() * 6.28 });
        });
      });
    };

    const draw = (now) => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const t = reduceMotion ? 0 : now / 1000;
      // pointer proximity picks a group
      let hover = -1, best = 1e9;
      hubs.forEach((hb) => {
        const d = Math.hypot(pointer.x - hb.x, pointer.y - hb.y);
        if (d < 120 && d < best) { best = d; hover = hb.gi; }
      });
      const active = lit >= 0 ? lit : hover;
      groups.forEach((g, i) => g.el.classList.toggle("is-lit", i === active));

      // core
      const pulse = 1 + Math.sin(t * 2) * 0.08;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 46 * pulse);
      grad.addColorStop(0, "rgba(205,255,250,.9)");
      grad.addColorStop(0.35, "rgba(87,216,206,.35)");
      grad.addColorStop(1, "rgba(87,216,206,0)");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, 46 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.font = '600 12px "Space Grotesk", sans-serif';
      ctx.fillStyle = "#041214";
      ctx.textAlign = "center";
      ctx.fillText("KOBE", cx, cy + 4);

      hubs.forEach((hb) => {
        const on = active === -1 || active === hb.gi;
        const c = COLORS[hb.gi];
        // spoke with travelling pulse
        ctx.strokeStyle = `rgba(${c},${on ? 0.35 : 0.08})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(hb.x, hb.y); ctx.stroke();
        const p = (t * 0.35 + hb.gi / 6) % 1;
        ctx.fillStyle = `rgba(${c},${on ? 0.9 : 0.2})`;
        ctx.beginPath(); ctx.arc(cx + (hb.x - cx) * p, cy + (hb.y - cy) * p, 2, 0, 6.28); ctx.fill();
      });

      nodes.forEach((n) => {
        const on = active === -1 || active === n.gi;
        const focused = active === n.gi;
        const a = n.baseA + (reduceMotion ? 0 : Math.sin(t * 0.4 + n.phase) * 0.08);
        const rr = n.r * (focused ? 1.35 : 1);
        n.x += (n.hub.x + Math.cos(a) * rr - n.x) * 0.12;
        n.y += (n.hub.y + Math.sin(a) * rr - n.y) * 0.12;
        const c = COLORS[n.gi];
        ctx.strokeStyle = `rgba(${c},${on ? (focused ? 0.5 : 0.2) : 0.05})`;
        ctx.beginPath(); ctx.moveTo(n.hub.x, n.hub.y); ctx.lineTo(n.x, n.y); ctx.stroke();
        ctx.fillStyle = `rgba(${c},${on ? 0.95 : 0.2})`;
        ctx.beginPath(); ctx.arc(n.x, n.y, focused ? 3.2 : 2.2, 0, 6.28); ctx.fill();
        if (focused) {
          ctx.font = '500 11px "IBM Plex Mono", monospace';
          ctx.fillStyle = "rgba(220,235,240,.95)";
          ctx.textAlign = n.x < n.hub.x ? "right" : "left";
          ctx.fillText(n.label, n.x + (n.x < n.hub.x ? -7 : 7), n.y + 3);
        }
      });

      hubs.forEach((hb) => {
        const on = active === -1 || active === hb.gi;
        const c = COLORS[hb.gi];
        ctx.fillStyle = "#070A0F";
        ctx.strokeStyle = `rgba(${c},${on ? 0.95 : 0.25})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(hb.x, hb.y, active === hb.gi ? 9 : 6.5, 0, 6.28); ctx.fill(); ctx.stroke();
        ctx.font = '600 11px "Space Grotesk", sans-serif';
        ctx.fillStyle = `rgba(244,247,251,${on ? 0.95 : 0.3})`;
        ctx.textAlign = "center";
        // label sits on the inner side of the hub, away from its skill cloud
        ctx.fillText(hb.label.toUpperCase(), hb.x, hb.y + (hb.y < cy - 5 ? 24 : hb.y > cy + 5 ? -16 : 24));
      });
    };

    layout();
    cv.parentElement.addEventListener("pointermove", (e) => {
      const r = cv.getBoundingClientRect();
      pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
    });
    cv.parentElement.addEventListener("pointerleave", () => { pointer.x = pointer.y = -999; });
    groups.forEach((g, i) => {
      g.el.addEventListener("mouseenter", () => { lit = i; });
      g.el.addEventListener("mouseleave", () => { lit = -1; });
    });
    let rt;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(layout, 200); });
    if (reduceMotion) { draw(0); } else whileVisible(cv, draw);
  }

  /* ================= Self-drawing timeline ================= */
  const timeline = document.getElementById("timeline");
  if (timeline) {
    const items = [...timeline.querySelectorAll(".achievement-item")];
    const update = () => {
      const r = timeline.getBoundingClientRect();
      const pos = innerHeight * 0.7 - r.top;
      const p = reduceMotion ? 1 : Math.max(0, Math.min(1, pos / r.height));
      timeline.style.setProperty("--tl", p.toFixed(4));
      items.forEach((it) => {
        const ir = it.getBoundingClientRect();
        it.classList.toggle("lit", reduceMotion || ir.top + 28 - r.top <= p * r.height);
      });
    };
    let tk = false;
    window.addEventListener("scroll", () => { if (!tk) { tk = true; requestAnimationFrame(() => { update(); tk = false; }); } }, { passive: true });
    update();
  }

  /* ================= Audio EQ bars (DAC project) ================= */
  const eq = document.querySelector(".eq-canvas");
  if (eq) {
    let ctx, w, h;
    const resize = () => ({ ctx, w, h } = fitCanvas(eq));
    resize();
    window.addEventListener("resize", resize);
    const bars = 42;
    const draw = (now) => {
      ctx.clearRect(0, 0, w, h);
      const bw = w / bars;
      for (let i = 0; i < bars; i++) {
        const t = now / 1000;
        const v = reduceMotion ? 0.4 : (Math.sin(t * 3 + i * 0.5) * 0.5 + 0.5) * (Math.sin(t * 1.3 + i * 0.17) * 0.4 + 0.6) * (1 - Math.abs(i - bars / 2) / bars);
        const bh = Math.max(2, v * h);
        const g = ctx.createLinearGradient(0, h, 0, h - bh);
        g.addColorStop(0, "rgba(224,144,79,.05)");
        g.addColorStop(1, "rgba(224,144,79,.55)");
        ctx.fillStyle = g;
        ctx.fillRect(i * bw + 1, h - bh, bw - 2, bh);
      }
    };
    if (reduceMotion) draw(0); else whileVisible(eq, draw);
  }

  /* ================= HUD frame readouts ================= */
  const hfSection = document.getElementById("hf-section");
  const hfScroll = document.getElementById("hf-scroll");
  const hfFps = document.getElementById("hf-fps");
  const hfClock = document.getElementById("hf-clock");
  const hfTicks = document.getElementById("hf-ticks");
  if (hfSection) {
    const secs = [...document.querySelectorAll("main > section")];
    const names = new Map(secs.map((s) => [s, `SYS/${(s.id || (s.dataset.build || "").split(".")[0] || "stream").toUpperCase()}`]));
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) hfSection.textContent = names.get(e.target) || "SYS"; });
      }, { rootMargin: "-45% 0px -50% 0px" });
      secs.forEach((s) => io.observe(s));
    }
    // scroll readouts update on scroll (cached page height, no per-frame layout reads)
    let maxScroll = 1;
    const measureMax = () => { maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight); };
    measureMax();
    window.addEventListener("resize", measureMax, { passive: true });
    if ("ResizeObserver" in window) new ResizeObserver(measureMax).observe(document.body);
    let sTick = false;
    window.addEventListener("scroll", () => {
      if (sTick) return;
      sTick = true;
      requestAnimationFrame(() => {
        hfScroll.textContent = `Y ${String(Math.round(scrollY)).padStart(5, "0")}`;
        hfTicks.style.setProperty("--sp", (scrollY / maxScroll).toFixed(4));
        sTick = false;
      });
    }, { passive: true });
    // FPS + clock: count frames, write text once per second
    let frames = 0, lastFps = performance.now();
    const hud = (now) => {
      frames++;
      if (now - lastFps > 1000) {
        hfFps.textContent = `${Math.round((frames * 1000) / (now - lastFps))} FPS`;
        frames = 0; lastFps = now;
        hfClock.textContent = new Date().toTimeString().slice(0, 8);
      }
      if (!reduceMotion && !document.hidden) requestAnimationFrame(hud);
    };
    requestAnimationFrame(hud);
    document.addEventListener("visibilitychange", () => { if (!document.hidden && !reduceMotion) requestAnimationFrame(hud); });
  }

  /* ================= Cursor spotlight + numeral parallax ================= */
  const spot = document.querySelector(".spotlight");
  if (spot && !reduceMotion && !KOBE.isTouch) {
    window.addEventListener("pointermove", (e) => {
      spot.style.setProperty("--sx", `${e.clientX}px`);
      spot.style.setProperty("--sy", `${e.clientY}px`);
    }, { passive: true });
  }
  const numbered = [...document.querySelectorAll("section[data-num]")];
  if (numbered.length && !reduceMotion) {
    // cache each section's page offset so scrolling never forces a layout read
    let tops = [];
    const measure = () => { tops = numbered.map((s) => { const r = s.getBoundingClientRect(); return [r.top + scrollY, r.height]; }); };
    let tk = false;
    const para = () => {
      const y = scrollY, h = innerHeight;
      numbered.forEach((s, i) => {
        const [top, height] = tops[i];
        const rel = top - y;
        if (rel + height < 0 || rel > h) return;
        s.style.setProperty("--py", `${Math.round((h - rel) * 0.18)}px`);
      });
      tk = false;
    };
    measure();
    window.addEventListener("resize", () => { measure(); para(); }, { passive: true });
    window.addEventListener("load", () => { measure(); para(); });
    if ("ResizeObserver" in window) new ResizeObserver(() => measure()).observe(document.body);
    window.addEventListener("scroll", () => { if (!tk) { tk = true; requestAnimationFrame(para); } }, { passive: true });
    para();
  }

  /* ================= Cursor particle trail + click shockwave ================= */
  const fx = document.getElementById("fx-canvas");
  if (fx && !reduceMotion && !KOBE.isTouch) {
    let ctx, w, h;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = innerWidth; h = innerHeight;
      fx.width = w * dpr; fx.height = h * dpr;
      ctx = fx.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const parts = [];
    const rings = [];
    let lx = 0, ly = 0, raf = 0;
    const loop = () => {
      raf = 0;
      ctx.clearRect(0, 0, w, h);
      // click shockwaves
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.t += 0.035;
        if (r.t >= 1) { rings.splice(i, 1); continue; }
        const e = 1 - Math.pow(1 - r.t, 3);
        ctx.strokeStyle = `rgba(87,216,206,${(1 - r.t) * 0.8})`;
        ctx.lineWidth = 2 * (1 - r.t) + 0.5;
        ctx.beginPath(); ctx.arc(r.x, r.y, 6 + e * 70, 0, 6.28); ctx.stroke();
        ctx.strokeStyle = `rgba(155,140,255,${(1 - r.t) * 0.5})`;
        ctx.beginPath(); ctx.arc(r.x, r.y, 4 + e * 42, 0, 6.28); ctx.stroke();
      }
      ctx.font = '600 10px "IBM Plex Mono", monospace';
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= 0.025;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        p.x += p.vx; p.y += p.vy; p.vy += 0.03;
        ctx.fillStyle = `rgba(${p.c},${p.life * 0.8})`;
        if (p.bit) ctx.fillText(p.bit, p.x, p.y);
        else { ctx.beginPath(); ctx.arc(p.x, p.y, 1.4 * p.life + 0.4, 0, 6.28); ctx.fill(); }
      }
      if (parts.length || rings.length) raf = requestAnimationFrame(loop);
    };
    window.addEventListener("pointerdown", (e) => {
      rings.push({ x: e.clientX, y: e.clientY, t: 0 });
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * 6.28, v = 1.5 + Math.random() * 2.5;
        parts.push({ x: e.clientX, y: e.clientY, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c: Math.random() < 0.5 ? "87,216,206" : "155,140,255", bit: Math.random() < 0.5 ? (Math.random() < 0.5 ? "0" : "1") : null });
      }
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
    window.addEventListener("pointermove", (e) => {
      const d = Math.hypot(e.clientX - lx, e.clientY - ly);
      lx = e.clientX; ly = e.clientY;
      const n = Math.min(3, Math.floor(d / 14));
      for (let i = 0; i < n && parts.length < 90; i++) {
        parts.push({
          x: e.clientX + (Math.random() - 0.5) * 6, y: e.clientY + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8,
          life: 1, c: Math.random() < 0.7 ? "87,216,206" : "224,144,79",
          bit: Math.random() < 0.35 ? (Math.random() < 0.5 ? "0" : "1") : null
        });
      }
      if (!raf && parts.length) raf = requestAnimationFrame(loop);
    }, { passive: true });
  }
})();
