(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const isTouch = window.matchMedia("(pointer: coarse)");

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
    menuBtn.addEventListener("click", () => {
      setMenu(menuBtn.getAttribute("aria-expanded") !== "true");
    });

    siteNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setMenu(false));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setMenu(false);
    });
  }

  let scrollTick = false;
  const updateScrollUI = () => {
    const y = window.scrollY;
    if (nav) nav.classList.toggle("scrolled", y > 10);

    const progress = document.querySelector(".scroll-progress span");
    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = `${max > 0 ? (y / max) * 100 : 0}%`;
    }
    scrollTick = false;
  };

  window.addEventListener("scroll", () => {
    if (!scrollTick) {
      window.requestAnimationFrame(updateScrollUI);
      scrollTick = true;
    }
  }, {passive: true});
  updateScrollUI();

  /* ---------- Section-aware navigation ---------- */
  const sectionLinks = [...document.querySelectorAll('.site-nav a[href^="#"]')];
  const observedSections = sectionLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if ("IntersectionObserver" in window) {
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = `#${entry.target.id}`;
        sectionLinks.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === id));
      });
    }, {rootMargin: "-35% 0px -55% 0px", threshold: 0});
    observedSections.forEach((section) => sectionObserver.observe(section));
  }

  /* ---------- Scroll reveal ---------- */
  const revealTargets = document.querySelectorAll(".reveal");

  if (reduceMotion.matches || !("IntersectionObserver" in window)) {
    revealTargets.forEach((el) => el.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, {threshold: 0.08, rootMargin: "0px 0px -50px 0px"});
    revealTargets.forEach((el) => revealObserver.observe(el));
  }

  /* ---------- Premium cursor ---------- */
  const dot = document.querySelector(".cursor-dot");
  const ring = document.querySelector(".cursor-ring");

  if (dot && ring && !isTouch.matches && !reduceMotion.matches) {
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;

    const renderCursor = () => {
      ringX += (mouseX - ringX) * 0.17;
      ringY += (mouseY - ringY) * 0.17;
      dot.style.left = `${mouseX}px`;
      dot.style.top = `${mouseY}px`;
      ring.style.left = `${ringX}px`;
      ring.style.top = `${ringY}px`;
      requestAnimationFrame(renderCursor);
    };

    window.addEventListener("pointermove", (event) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      dot.style.opacity = "1";
      ring.style.opacity = "1";
    }, {passive: true});

    document.addEventListener("mouseleave", () => {
      dot.style.opacity = "0";
      ring.style.opacity = "0";
    });

    document.querySelectorAll("a, button, .tilt-card").forEach((el) => {
      el.addEventListener("mouseenter", () => ring.classList.add("is-hover"));
      el.addEventListener("mouseleave", () => ring.classList.remove("is-hover"));
    });

    document.addEventListener("pointerdown", () => ring.classList.add("is-click"));
    document.addEventListener("pointerup", () => ring.classList.remove("is-click"));

    renderCursor();
  }

  /* ---------- Magnetic buttons ---------- */
  if (!isTouch.matches && !reduceMotion.matches) {
    document.querySelectorAll(".magnetic").forEach((el) => {
      el.addEventListener("pointermove", (event) => {
        const rect = el.getBoundingClientRect();
        const x = event.clientX - (rect.left + rect.width / 2);
        const y = event.clientY - (rect.top + rect.height / 2);
        el.style.transform = `translate(${x * 0.10}px, ${y * 0.10}px)`;
      });

      el.addEventListener("pointerleave", () => {
        el.style.transform = "";
      });
    });
  }

  /* ---------- Subtle 3D tilt ---------- */
  if (!isTouch.matches && !reduceMotion.matches) {
    document.querySelectorAll(".tilt-card").forEach((card) => {
      const strength = Number(card.dataset.tiltStrength || 5);

      card.addEventListener("pointermove", (event) => {
        const rect = card.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        const rotateX = (0.5 - py) * strength;
        const rotateY = (px - 0.5) * strength;
        card.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
      });

      card.addEventListener("pointerleave", () => {
        card.style.transform = "";
      });
    });
  }

  /* ---------- Placeholder link protection ---------- */
  const placeholderLabels = {
    email: "Add your email",
    github: "Add your GitHub URL",
    linkedin: "Add your LinkedIn URL",
    cv: "Add your CV link"
  };

  document.querySelectorAll("[data-placeholder]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const type = link.dataset.placeholder || "link";
      const target = link.querySelector("span") || link;
      const previous = target.textContent;
      target.textContent = placeholderLabels[type] || "Add your link";
      window.dispatchEvent(new CustomEvent("portfolio:placeholder", {detail: {type}}));
      setTimeout(() => { target.textContent = previous; }, 1800);
    });
  });

  /* ---------- Smooth project hover lighting ---------- */
  document.querySelectorAll(".project-card").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const visual = card.querySelector(".project-visual");
      if (!visual || isTouch.matches) return;
      const rect = visual.getBoundingClientRect();
      visual.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      visual.style.setProperty("--my", `${event.clientY - rect.top}px`);
    });
  });

  /* ---------- Animated circuit field ---------- */
  const canvas = document.getElementById("circuit-bg");
  if (canvas && !reduceMotion.matches) {
    const ctx = canvas.getContext("2d", {alpha: true});
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let nodes = [];
    let edges = [];
    let pulses = [];
    let animationFrame = 0;
    let running = !document.hidden;

    const palette = {
      line: "rgba(148,163,184,0.07)",
      node: "rgba(148,163,184,0.18)",
      cyan: "87,216,206",
      copper: "224,144,79"
    };

    const seed = Math.random() * 1000;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildGraph();
    };

    const rand = (min, max) => min + Math.random() * (max - min);

    const buildGraph = () => {
      const density = width < 700 ? 0.74 : 1;
      const spacing = Math.max(150, Math.min(width, height) / (8 * density));
      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;

      nodes = [];
      edges = [];
      pulses = [];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const jitter = 18 + (seed % 6);
          nodes.push({
            x: c * spacing + (r % 2 ? spacing * 0.48 : 0) + rand(-jitter, jitter),
            y: r * spacing + rand(-jitter, jitter),
          });
        }
      }

      const distanceSq = (a, b) => {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return dx * dx + dy * dy;
      };

      for (let i = 0; i < nodes.length; i++) {
        const nearby = nodes
          .map((node, index) => ({node, index, d: distanceSq(nodes[i], node)}))
          .filter((item) => item.index !== i)
          .sort((a, b) => a.d - b.d)
          .slice(0, 2);

        nearby.forEach(({node}) => {
          const keyA = `${nodes[i].x.toFixed(1)}:${nodes[i].y.toFixed(1)}`;
          const keyB = `${node.x.toFixed(1)}:${node.y.toFixed(1)}`;
          if (!edges.some((edge) => edge.keyA === keyB && edge.keyB === keyA)) {
            edges.push({x1: nodes[i].x, y1: nodes[i].y, x2: node.x, y2: node.y, keyA, keyB});
          }
        });
      }

      for (let i = 0; i < (width < 700 ? 4 : 7); i++) spawnPulse();
    };

    const spawnPulse = () => {
      if (nodes.length < 2) return;
      const start = nodes[Math.floor(Math.random() * nodes.length)];
      const candidates = nodes
        .filter((node) => node !== start)
        .map((node) => ({node, d: Math.hypot(node.x - start.x, node.y - start.y)}))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3);

      if (!candidates.length) return;
      const end = candidates[Math.floor(Math.random() * candidates.length)].node;

      pulses.push({
        x1: start.x, y1: start.y, x2: end.x, y2: end.y,
        t: 0, speed: rand(0.0045, 0.0085),
        color: Math.random() > 0.54 ? palette.cyan : palette.copper
      });
    };

    const draw = () => {
      if (!running) return;
      ctx.clearRect(0, 0, width, height);

      ctx.strokeStyle = palette.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      edges.forEach((edge) => {
        ctx.moveTo(edge.x1, edge.y1);
        ctx.lineTo(edge.x2, edge.y2);
      });
      ctx.stroke();

      ctx.fillStyle = palette.node;
      ctx.beginPath();
      nodes.forEach((node) => {
        ctx.moveTo(node.x + 1.25, node.y);
        ctx.arc(node.x, node.y, 1.25, 0, Math.PI * 2);
      });
      ctx.fill();

      for (let i = pulses.length - 1; i >= 0; i--) {
        const pulse = pulses[i];
        pulse.t += pulse.speed;

        if (pulse.t >= 1) {
          pulses.splice(i, 1);
          spawnPulse();
          continue;
        }

        const x = pulse.x1 + (pulse.x2 - pulse.x1) * pulse.t;
        const y = pulse.y1 + (pulse.y2 - pulse.y1) * pulse.t;
        const fade = Math.sin(pulse.t * Math.PI);

        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${pulse.color},${0.72 * fade})`;
        ctx.shadowColor = `rgba(${pulse.color},${0.8 * fade})`;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animationFrame = requestAnimationFrame(draw);
    };

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 220);
    }, {passive:true});

    document.addEventListener("visibilitychange", () => {
      running = !document.hidden;
      if (running && !animationFrame) draw();
      if (!running && animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
    });

    resize();
    draw();
  }
})();
