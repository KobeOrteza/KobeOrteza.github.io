/* neural-bg.js — living neural network background that reacts to mouse + scroll */
(() => {
  "use strict";
  const KOBE = window.KOBE || {};
  const canvas = document.getElementById("neural-bg");
  if (!canvas || KOBE.reduceMotion) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let W = 0, H = 0, dpr = 1;
  let nodes = [];
  let pulses = [];
  let raf = 0;
  let lastScroll = window.scrollY;
  let scrollVel = 0;
  const LINK = 150;
  const MOUSE_R = 190;

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(120, (W * H) / 14000));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      r: 0.8 + Math.random() * 1.4,
      hue: Math.random() < 0.7 ? 0 : 1
    }));
    pulses = [];
  };

  const spawnPulse = (a, b) => {
    if (pulses.length > 26) return;
    pulses.push({ a, b, t: 0, s: 0.012 + Math.random() * 0.02, c: Math.random() < 0.6 ? "87,216,206" : "224,144,79" });
  };

  const draw = () => {
    raf = 0;
    if (document.hidden) return;
    const m = KOBE.mouse || { x: -9999, y: -9999 };
    const sy = window.scrollY;
    scrollVel = scrollVel * 0.9 + (sy - lastScroll) * 0.1;
    lastScroll = sy;

    ctx.clearRect(0, 0, W, H);

    // move nodes; scrolling streams them upward slightly (parallax)
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy - scrollVel * 0.08;
      const dx = m.x - n.x, dy = m.y - n.y;
      const d = Math.hypot(dx, dy);
      if (d < MOUSE_R && d > 1) { n.x += (dx / d) * 0.25; n.y += (dy / d) * 0.25; }
      if (n.x < -20) n.x = W + 20; else if (n.x > W + 20) n.x = -20;
      if (n.y < -20) n.y = H + 20; else if (n.y > H + 20) n.y = -20;
    }

    // links
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > LINK * LINK) continue;
        const d = Math.sqrt(d2);
        // links near the mouse glow brighter
        const mx = (a.x + b.x) / 2 - m.x, my = (a.y + b.y) / 2 - m.y;
        const near = Math.max(0, 1 - Math.hypot(mx, my) / (MOUSE_R * 1.4));
        const alpha = (1 - d / LINK) * (0.07 + near * 0.35);
        ctx.strokeStyle = near > 0.05 ? `rgba(87,216,206,${alpha})` : `rgba(148,163,184,${alpha})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        if (Math.random() < 0.0009 + near * 0.004) spawnPulse(a, b);
      }
      // mouse synapse
      const dxm = a.x - m.x, dym = a.y - m.y;
      const dm = Math.hypot(dxm, dym);
      if (dm < MOUSE_R) {
        ctx.strokeStyle = `rgba(87,216,206,${(1 - dm / MOUSE_R) * 0.32})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(m.x, m.y); ctx.stroke();
      }
    }

    // nodes
    for (const n of nodes) {
      const dm = Math.hypot(n.x - m.x, n.y - m.y);
      const glow = Math.max(0, 1 - dm / MOUSE_R);
      ctx.fillStyle = n.hue ? `rgba(224,144,79,${0.25 + glow * 0.6})` : `rgba(148,200,210,${0.22 + glow * 0.6})`;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r + glow * 1.5, 0, Math.PI * 2); ctx.fill();
    }

    // pulses travelling along links
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.t += p.s;
      if (p.t >= 1) { pulses.splice(i, 1); continue; }
      const x = p.a.x + (p.b.x - p.a.x) * p.t;
      const y = p.a.y + (p.b.y - p.a.y) * p.t;
      const f = Math.sin(p.t * Math.PI);
      ctx.fillStyle = `rgba(${p.c},${0.85 * f})`;
      ctx.shadowColor = `rgba(${p.c},${f})`;
      ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    raf = requestAnimationFrame(draw);
  };

  let t;
  let stopped = false;
  window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(resize, 200); }, { passive: true });
  document.addEventListener("visibilitychange", () => { if (!stopped && !document.hidden && !raf) raf = requestAnimationFrame(draw); });
  resize();
  raf = requestAnimationFrame(draw);

  // The WebGL background (scene3d.js) calls this when it starts successfully.
  KOBE.stopNeural = () => {
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    canvas.style.display = "none";
  };
})();
