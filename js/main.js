/* main.js — shared state, boot sequence, navigation, cursor, micro-interactions */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  const isSmall = () => window.innerWidth <= 800;

  /* ---------- Shared namespace ---------- */
  const KOBE = (window.KOBE = window.KOBE || {});
  KOBE.reduceMotion = reduceMotion;
  KOBE.isTouch = isTouch;
  KOBE.isSmall = isSmall;
  KOBE.mouse = { x: innerWidth / 2, y: innerHeight / 2, active: false };
  KOBE.booted = false;
  KOBE.onBoot = (fn) => (KOBE.booted ? fn() : window.addEventListener("kobe:booted", fn, { once: true }));

  window.addEventListener("pointermove", (e) => {
    KOBE.mouse.x = e.clientX;
    KOBE.mouse.y = e.clientY;
    KOBE.mouse.active = true;
  }, { passive: true });

  /* ---------- Sound (engine lives in sfx.js; off by default) ---------- */
  const sfx = (name, opts) => KOBE.sfx && KOBE.sfx(name, opts);
  const soundBtn = document.getElementById("sound-toggle");
  const soundHint = document.getElementById("sound-hint");
  const syncSoundBtn = () => soundBtn && soundBtn.setAttribute("aria-pressed", String(!!(KOBE.soundOn && KOBE.soundOn())));
  syncSoundBtn();
  window.addEventListener("kobe:sound", syncSoundBtn);
  const hideHint = () => soundHint && soundHint.classList.remove("is-on");

  if (soundBtn && KOBE.setSound) {
    soundBtn.addEventListener("click", () => { KOBE.setSound(!KOBE.soundOn()); hideHint(); });
  }
  const yes = document.getElementById("sound-yes");
  if (yes && KOBE.setSound) yes.addEventListener("click", () => { KOBE.setSound(true); hideHint(); });

  // gentle prompt after boot (once per session, only if sound is off)
  KOBE.onBoot(() => {
    let asked = false;
    try { asked = sessionStorage.getItem("kobe-sound-asked") === "1"; } catch (_) {}
    if (!soundHint || asked || (KOBE.soundOn && KOBE.soundOn()) || reduceMotion) return;
    setTimeout(() => soundHint.classList.add("is-on"), 2600);
    setTimeout(hideHint, 9500);
    try { sessionStorage.setItem("kobe-sound-asked", "1"); } catch (_) {}
  });

  // hover ticks + click chirps on every interactive element (event delegation)
  if (!isTouch) {
    document.addEventListener("mouseover", (e) => {
      const el = e.target.closest("a, button, .chips li, .skill-group li");
      if (el && !el.contains(e.relatedTarget)) sfx("hover");
    });
  }
  document.addEventListener("click", (e) => { if (e.target.closest("a, button")) sfx("click"); });

  /* ---------- Boot sequence ---------- */
  const boot = document.getElementById("boot");
  const bootLog = document.getElementById("boot-log");
  const bootBar = document.getElementById("boot-bar");

  const finishBoot = () => {
    if (KOBE.booted) return;
    KOBE.booted = true;
    document.body.classList.add("booted");
    sfx("booted");
    try { sessionStorage.setItem("kobe-booted", "1"); } catch (_) {}
    window.dispatchEvent(new Event("kobe:booted"));
  };

  const runBoot = () => {
    if (!boot || reduceMotion) return finishBoot();
    let seen = false;
    try { seen = sessionStorage.getItem("kobe-booted") === "1"; } catch (_) {}
    const lines = [
      ["> initializing neural core", "…", "ok"],
      ["> loading hologram.bits", "…", "ok"],
      ["> mounting ai_builder.agent", "…", "ok"],
      ["> linking kobe.ai assistant", "…", "ok"],
      ["> compiling portfolio", "…", "ready"]
    ];
    const step = seen ? 110 : 300;
    let i = 0;
    let timer;
    const tick = () => {
      if (i < lines.length) {
        const [label, dots, status] = lines[i];
        const cls = status === "ready" ? "warn" : "ok";
        bootLog.innerHTML += `${label} ${dots} <span class="${cls}">✓ ${status}</span>\n`;
        bootBar.style.width = `${((i + 1) / lines.length) * 100}%`;
        sfx("boot", { step: i });
        i++;
        timer = setTimeout(tick, step);
      } else {
        timer = setTimeout(finishBoot, seen ? 150 : 380);
      }
    };
    boot.addEventListener("click", () => { clearTimeout(timer); finishBoot(); });
    tick();
  };
  if (document.readyState === "complete") runBoot();
  else window.addEventListener("load", runBoot, { once: true });
  // Safety net: never trap visitors behind the boot screen.
  setTimeout(finishBoot, 6000);

  /* ---------- Smooth, inertial scrolling (Lenis) — mouse/trackpad only ---------- */
  if (window.Lenis && !reduceMotion && !isTouch) {
    try {
      const lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
      KOBE.lenis = lenis;
      const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
      // in-page links glide with the same easing, landing below the sticky nav
      document.addEventListener("click", (e) => {
        const a = e.target.closest('a[href^="#"]');
        if (!a || a.hasAttribute("data-placeholder")) return;
        const id = a.getAttribute("href");
        if (id.length < 2) return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        const navH = (document.getElementById("nav") || {}).offsetHeight || 0;
        lenis.scrollTo(target, { offset: -navH - 16, duration: 1.4 });
        history.replaceState(null, "", id);
      });
    } catch (_) { /* fall back to native scrolling */ }
  }

  /* ---------- Navigation ---------- */
  const nav = document.getElementById("nav");
  const menuBtn = document.getElementById("menu-btn");
  const siteNav = document.getElementById("site-nav");

  const setMenu = (open) => {
    if (!menuBtn || !siteNav) return;
    siteNav.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("nav-open", open);
  };
  if (menuBtn && siteNav) {
    menuBtn.addEventListener("click", () => setMenu(menuBtn.getAttribute("aria-expanded") !== "true"));
    siteNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenu(false)));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
  }

  const progress = document.querySelector(".scroll-progress span");
  let scrollTick = false;
  const updateScrollUI = () => {
    const y = window.scrollY;
    nav && nav.classList.toggle("scrolled", y > 10);
    if (progress) {
      const max = document.documentElement.scrollHeight - innerHeight;
      progress.style.width = `${max > 0 ? (y / max) * 100 : 0}%`;
    }
    scrollTick = false;
  };
  window.addEventListener("scroll", () => {
    if (!scrollTick) { requestAnimationFrame(updateScrollUI); scrollTick = true; }
  }, { passive: true });
  updateScrollUI();

  const sectionLinks = [...document.querySelectorAll('.site-nav a[href^="#"]')];
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = `#${entry.target.id}`;
        sectionLinks.forEach((l) => l.classList.toggle("active", l.getAttribute("href") === id));
      });
    }, { rootMargin: "-35% 0px -55% 0px" });
    sectionLinks.map((l) => document.querySelector(l.getAttribute("href"))).filter(Boolean).forEach((s) => io.observe(s));
  }

  /* ---------- Custom cursor ---------- */
  const dot = document.querySelector(".cursor-dot");
  const ring = document.querySelector(".cursor-ring");
  if (dot && ring && !isTouch && !reduceMotion) {
    let rx = KOBE.mouse.x, ry = KOBE.mouse.y;
    const render = () => {
      rx += (KOBE.mouse.x - rx) * 0.18;
      ry += (KOBE.mouse.y - ry) * 0.18;
      dot.style.transform = `translate(${KOBE.mouse.x}px, ${KOBE.mouse.y}px) translate(-50%, -50%)`;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
      requestAnimationFrame(render);
    };
    dot.style.left = dot.style.top = ring.style.left = ring.style.top = "0px";
    window.addEventListener("pointermove", () => { dot.style.opacity = "1"; ring.style.opacity = "1"; }, { passive: true });
    document.addEventListener("mouseleave", () => { dot.style.opacity = "0"; ring.style.opacity = "0"; });
    document.addEventListener("mouseover", (e) => {
      ring.classList.toggle("is-hover", !!e.target.closest("a, button, .tilt-card, input"));
    });
    document.addEventListener("pointerdown", () => ring.classList.add("is-click"));
    document.addEventListener("pointerup", () => ring.classList.remove("is-click"));
    render();
  }

  /* ---------- Magnetic buttons + 3D tilt ---------- */
  if (!isTouch && !reduceMotion) {
    document.querySelectorAll(".magnetic").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.12}px, ${(e.clientY - r.top - r.height / 2) * 0.12}px)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });

    document.querySelectorAll(".tilt-card").forEach((card) => {
      const strength = Number(card.dataset.tiltStrength || 5);
      card.addEventListener("pointermove", (e) => {
        if (!card.classList.contains("bt-built") && card.classList.contains("bt")) return;
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.style.transform = `perspective(1200px) rotateX(${(0.5 - py) * strength}deg) rotateY(${(px - 0.5) * strength}deg) translateY(-2px)`;
      });
      card.addEventListener("pointerleave", () => { card.style.transform = ""; });
    });
  }

  /* Project hover light */
  document.querySelectorAll(".project-card").forEach((card) => {
    const visual = card.querySelector(".project-visual");
    if (!visual || isTouch) return;
    card.addEventListener("pointermove", (e) => {
      const r = visual.getBoundingClientRect();
      visual.style.setProperty("--mx", `${e.clientX - r.left}px`);
      visual.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });

  /* ---------- Placeholder contact links ---------- */
  const placeholderLabels = { email: "Add your email", github: "Add your GitHub URL", linkedin: "Add your LinkedIn URL", cv: "Add your CV link" };
  document.querySelectorAll("[data-placeholder]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = link.querySelector("span") || link;
      const prev = target.textContent;
      target.textContent = placeholderLabels[link.dataset.placeholder] || "Add your link";
      setTimeout(() => { target.textContent = prev; }, 1800);
    });
  });

  /* ---------- Text decode (scramble → real text) ---------- */
  const GLYPHS = "01<>/{}[]=+*#%&$@";
  KOBE.decode = (el, { duration = 1100, delay = 0 } = {}) => {
    const finalText = el.dataset.final || el.textContent;
    el.dataset.final = finalText;
    if (reduceMotion) { el.textContent = finalText; return; }
    el.setAttribute("aria-label", finalText);
    const start = performance.now() + delay;
    const frame = (now) => {
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      const revealed = Math.floor(t * finalText.length);
      let html = "";
      for (let i = 0; i < finalText.length; i++) {
        const ch = finalText[i];
        if (i < revealed || ch === " ") html += ch === "<" ? "&lt;" : ch;
        else html += `<span class="glyph" aria-hidden="true">${GLYPHS[(Math.random() * GLYPHS.length) | 0].replace("<", "&lt;")}</span>`;
      }
      el.innerHTML = html;
      if (t < 1) requestAnimationFrame(frame);
      else { el.textContent = finalText; el.removeAttribute("aria-label"); }
    };
    requestAnimationFrame(frame);
  };

  KOBE.onBoot(() => {
    document.querySelectorAll("[data-decode]").forEach((el, i) => KOBE.decode(el, { delay: 150 + i * 260, duration: 900 }));
  });

  /* ---------- Role typer ---------- */
  const typer = document.getElementById("role-typer");
  if (typer && !reduceMotion) {
    const roles = ["AI Engineer", "ML Builder", "Hardware Hacker", "Computer Vision Tinkerer", "Robotics Competitor"];
    let r = 0, c = roles[0].length, deleting = true;
    const loop = () => {
      const word = roles[r];
      if (deleting) {
        c--;
        if (c <= 0) { deleting = false; r = (r + 1) % roles.length; }
      } else {
        c++;
        if (c >= roles[r].length) { deleting = true; typer.textContent = roles[r]; return setTimeout(loop, 1900); }
      }
      typer.textContent = (deleting ? word : roles[r]).slice(0, Math.max(0, c));
      setTimeout(loop, deleting ? 38 : 70);
    };
    KOBE.onBoot(() => setTimeout(loop, 2200));
  }

  /* ---------- Count-up numbers ---------- */
  const counters = document.querySelectorAll("[data-count]");
  const runCount = (el) => {
    if (el.dataset.done) return;
    el.dataset.done = "1";
    const to = Number(el.dataset.count);
    const from = Number(el.dataset.from || 0);
    const pad = to < 10 ? 2 : 0;
    if (reduceMotion) { el.textContent = String(to).padStart(pad, "0"); return; }
    const start = performance.now();
    const dur = 1400;
    const frame = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(from + (to - from) * eased)).padStart(pad, "0");
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) runCount(e.target); });
    }, { threshold: 0.6 });
    counters.forEach((c) => io.observe(c));
  } else counters.forEach(runCount);

  /* ---------- Small "live" numbers inside project visuals ---------- */
  if (!reduceMotion) {
    document.querySelectorAll("[data-live]").forEach((el) => {
      const [lo, hi] = el.dataset.live.split("-").map(Number);
      const suffix = el.dataset.suffix || "";
      setInterval(() => {
        if (document.hidden) return;
        el.textContent = `${Math.round(lo + Math.random() * (hi - lo))}${suffix}`;
      }, 1600 + Math.random() * 900);
    });
  }
})();
