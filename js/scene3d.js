/* scene3d.js — WebGL layer (three.js via the import map in index.html)
   1. Full-page background: a GPU "data ocean" of points + a floating wireframe
      neural core + drifting dust, colour-shifting as you scroll.
   2. Hardware section: the ES9038Q2M DAC board modelled in Blender
      (assets/3d/dac-board.glb) with glowing traces, bloom, drag-to-rotate.
   Falls back silently to the 2D canvas background / CSS chip if WebGL or the CDN
   isn't available. */
(() => {
  "use strict";
  const KOBE = window.KOBE || {};
  const reduceMotion = !!KOBE.reduceMotion;
  const isTouch = !!KOBE.isTouch;
  const small = () => innerWidth <= 800;

  const hasWebGL = (() => {
    try {
      const c = document.createElement("canvas");
      return !!(window.WebGL2RenderingContext && c.getContext("webgl2"));
    } catch (_) { return false; }
  })();
  if (!hasWebGL) return;

  // Low-end hint: few cores or low memory → lighter settings
  const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;

  import("three").then((THREE) => {
    initBackground(THREE);
    initHardware(THREE);
  }).catch((err) => console.warn("3D layer unavailable, using 2D fallback:", err));

  /* =====================================================================
     1) Background data ocean
     ===================================================================== */
  function initBackground(THREE) {
    const canvas = document.getElementById("bg3d");
    if (!canvas) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "high-performance" });
    } catch (_) { return; }
    let quality = small() || lowEnd ? 0.75 : Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(quality);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x070a0f, 0.045);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
    camera.position.set(0, 3.4, 11);

    /* --- ocean of points --- */
    const N = small() || lowEnd ? 110 : 180;
    const SIZE = 46;
    const pos = new Float32Array(N * N * 3);
    let k = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      pos[k++] = (i / (N - 1) - 0.5) * SIZE;
      pos[k++] = 0;
      pos[k++] = (j / (N - 1) - 0.5) * SIZE;
    }
    const oceanGeo = new THREE.BufferGeometry();
    oceanGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const uniforms = {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uColA: { value: new THREE.Color(0x57d8ce) },
      uColB: { value: new THREE.Color(0x9b8cff) },
      uPixel: { value: renderer.getPixelRatio() }
    };
    const ocean = new THREE.Points(oceanGeo, new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        uniform float uTime, uScroll, uPixel;
        uniform vec2 uMouse;
        varying float vH;
        varying float vFade;
        void main(){
          vec3 p = position;
          float t = uTime * 0.45;
          float z = p.z + uScroll * 14.0;
          float h = sin(p.x * 0.32 + t) * 0.55
                  + sin(z * 0.27 + t * 1.3) * 0.5
                  + sin((p.x + z) * 0.15 - t * 0.7) * 0.7;
          // ripple around the projected mouse point
          float d = distance(p.xz, uMouse * vec2(14.0, 9.0) + vec2(0.0, 4.0));
          h += sin(d * 1.4 - uTime * 3.0) * 0.35 * exp(-d * 0.18);
          p.y = h - 2.2;
          vH = h;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (2.2 + h * 0.9) * uPixel * (14.0 / -mv.z);
          vFade = smoothstep(42.0, 6.0, -mv.z);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColA, uColB;
        varying float vH;
        varying float vFade;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c);
          if (r > 0.5) discard;
          float a = smoothstep(0.5, 0.0, r);
          vec3 col = mix(uColA, uColB, clamp(vH * 0.6 + 0.4, 0.0, 1.0));
          gl_FragColor = vec4(col, a * vFade * (0.35 + clamp(vH, 0.0, 1.0) * 0.5));
        }`
    }));
    scene.add(ocean);

    /* --- neural core: wireframe icosahedron + glowing vertex nodes --- */
    const core = new THREE.Group();
    const ico = new THREE.IcosahedronGeometry(2.4, 1);
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(ico),
      new THREE.LineBasicMaterial({ color: 0x57d8ce, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    const inner = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.3, 0)),
      new THREE.LineBasicMaterial({ color: 0x9b8cff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    const dotTex = (() => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d");
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, "rgba(255,255,255,1)");
      grd.addColorStop(0.25, "rgba(255,255,255,.65)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    const nodes = new THREE.Points(ico, new THREE.PointsMaterial({
      size: 0.26, map: dotTex, color: 0xcffffb, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xe0904f, transparent: true, opacity: 0.22, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.01, 6, 120), ringMat);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.007, 6, 120), ringMat.clone());
    ring2.material.color.set(0x57d8ce);
    ring1.rotation.x = 1.2; ring2.rotation.x = 1.6; ring2.rotation.y = 0.5;
    core.add(wire, inner, nodes, ring1, ring2);
    core.position.set(12, 5.4, -11);
    scene.add(core);

    /* --- drifting dust --- */
    const DUST = small() || lowEnd ? 260 : 600;
    const dpos = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i++) {
      dpos[i * 3] = (Math.random() - 0.5) * 40;
      dpos[i * 3 + 1] = Math.random() * 14 - 2;
      dpos[i * 3 + 2] = (Math.random() - 0.5) * 30 - 4;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dpos, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      size: 0.09, map: dotTex, color: 0x9fe8e2, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    scene.add(dust);

    /* --- palette per scroll position: cyan → violet → copper → cyan --- */
    const stops = [
      [0x57d8ce, 0x9b8cff],
      [0x9b8cff, 0x57d8ce],
      [0xe0904f, 0x9b8cff],
      [0x57d8ce, 0xe0904f]
    ].map(([a, b]) => [new THREE.Color(a), new THREE.Color(b)]);
    const tmpA = new THREE.Color(), tmpB = new THREE.Color();

    const resize = () => {
      const w = innerWidth, h = innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.z = w < 700 ? 13 : 11;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });

    // success → retire the 2D fallback
    KOBE.stopNeural && KOBE.stopNeural();
    document.documentElement.classList.add("has-3d");

    let smx = 0, smy = 0, sScroll = 0;
    let running = true;
    let frames = 0, fpsT = performance.now(), downgraded = 0;
    const clock = new THREE.Clock();

    const frame = () => {
      if (!running) return;
      requestAnimationFrame(frame);
      if (document.hidden) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      const sp = scrollY / max;
      sScroll += (sp - sScroll) * 0.08;
      const m = KOBE.mouse || { x: innerWidth / 2, y: innerHeight / 2 };
      smx += ((m.x / innerWidth) * 2 - 1 - smx) * 0.05;
      smy += ((m.y / innerHeight) * 2 - 1 - smy) * 0.05;

      uniforms.uTime.value = t;
      uniforms.uScroll.value = sScroll;
      uniforms.uMouse.value.set(smx, smy);

      // palette blend
      const f = sScroll * (stops.length - 1);
      const i0 = Math.min(stops.length - 2, Math.floor(f)), u = f - i0;
      tmpA.copy(stops[i0][0]).lerp(stops[i0 + 1][0], u);
      tmpB.copy(stops[i0][1]).lerp(stops[i0 + 1][1], u);
      uniforms.uColA.value.copy(tmpA);
      uniforms.uColB.value.copy(tmpB);
      wire.material.color.copy(tmpA);

      core.rotation.y += dt * 0.18;
      core.rotation.x = Math.sin(t * 0.3) * 0.25;
      inner.rotation.y -= dt * 0.5;
      ring1.rotation.z += dt * 0.4;
      ring2.rotation.z -= dt * 0.25;
      // keep the core clear of the hologram: top-left on narrow screens, far top-right on wide ones;
      // it drifts across the page as you scroll
      const narrow = innerWidth < 1081;
      core.position.x = (innerWidth < 600 ? -7.5 : narrow ? -5.5 : 12) + (narrow ? -0.5 : -2.5) * sScroll;
      core.position.y = (innerWidth < 600 ? 8 : narrow ? 6.2 : 5.4) + Math.sin(t * 0.6) * 0.35 - sScroll * 3.5;
      core.position.z = narrow ? -13 : -11;
      dust.rotation.y = t * 0.02;
      dust.position.y = -sScroll * 4;

      // camera: mouse parallax + glide down/forward with scroll
      camera.position.x += (smx * 1.2 - camera.position.x) * 0.05;
      camera.position.y += (3.4 - smy * 0.6 - sScroll * 1.6 - camera.position.y) * 0.05;
      camera.lookAt(0, -sScroll * 1.5, -4);

      renderer.render(scene, camera);

      // adaptive quality: if we're dropping frames, lower the resolution (twice at most)
      frames++;
      const now = performance.now();
      if (now - fpsT > 2000) {
        const fps = (frames * 1000) / (now - fpsT);
        frames = 0; fpsT = now;
        if (fps < 42 && downgraded < 2) {
          downgraded++;
          quality = Math.max(0.5, quality * 0.7);
          renderer.setPixelRatio(quality);
          uniforms.uPixel.value = quality;
          resize();
        }
      }
    };

    if (reduceMotion) {
      renderer.render(scene, camera);
      running = false;
    } else frame();
  }

  /* =====================================================================
     2) Hardware: Blender-modelled DAC board
     ===================================================================== */
  function initHardware(THREE) {
    const host = document.querySelector(".hardware-art");
    if (!host || location.protocol === "file:") return; // GLB needs http(s); CSS chip stays as fallback
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      Promise.all([
        import("three/addons/loaders/GLTFLoader.js"),
        import("three/addons/environments/RoomEnvironment.js"),
        small() || lowEnd ? Promise.resolve(null) : Promise.all([
          import("three/addons/postprocessing/EffectComposer.js"),
          import("three/addons/postprocessing/RenderPass.js"),
          import("three/addons/postprocessing/UnrealBloomPass.js"),
          import("three/addons/postprocessing/OutputPass.js")
        ])
      ]).then(([{ GLTFLoader }, { RoomEnvironment }, post]) => {
        new GLTFLoader().load("assets/3d/dac-board.glb", (gltf) => build(gltf, RoomEnvironment, post),
          undefined, (e) => console.warn("DAC model failed to load:", e));
      }).catch((e) => console.warn("3D hardware scene unavailable:", e));
    };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); start(); } }, { rootMargin: "700px 0px" });
      io.observe(host);
    } else start();

    function build(gltf, RoomEnvironment, post) {
      const canvas = document.createElement("canvas");
      canvas.className = "dac3d";
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "3D model of the ES9038Q2M DAC board — drag to rotate");
      host.appendChild(canvas);

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small() ? 1.5 : 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.82;
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a1016);
      scene.fog = new THREE.Fog(0x0a1016, 9, 22);
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.45;

      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
      camera.position.set(0, 5.6, 6.2);
      camera.lookAt(0, 0, 0);

      const key = new THREE.DirectionalLight(0xffffff, 0.9);
      key.position.set(4, 6, 3);
      const rimC = new THREE.PointLight(0x57d8ce, 18, 12); rimC.position.set(-3.5, 1.5, -2.5);
      const rimO = new THREE.PointLight(0xe0904f, 14, 12); rimO.position.set(3.5, 1.2, -2.8);
      scene.add(key, rimC, rimO, new THREE.AmbientLight(0x406070, 0.4));

      // blueprint floor grid
      const grid = new THREE.GridHelper(30, 60, 0x57d8ce, 0x1b2a33);
      grid.position.y = -0.6;
      grid.material.transparent = true;
      grid.material.opacity = 0.25;
      scene.add(grid);

      const board = gltf.scene;
      const pivot = new THREE.Group();
      pivot.add(board);
      scene.add(pivot);
      const traceMats = [], ledMats = [];
      board.traverse((o) => {
        if (!o.isMesh) return;
        const n = o.material && o.material.name;
        if (n === "Trace" || n === "CopperTrace") traceMats.push(o.material);
        if (n === "LED") ledMats.push(o.material);
      });

      // floating signal particles that orbit the chip
      const PART = 140;
      const pp = new Float32Array(PART * 3);
      const seeds = [];
      for (let i = 0; i < PART; i++) seeds.push([Math.random() * 6.28, 0.7 + Math.random() * 1.8, Math.random() * 0.8 + 0.1, Math.random() * 1.5 + 0.3]);
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute("position", new THREE.BufferAttribute(pp, 3));
      const parts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.05, color: 0x9ff5ee, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      scene.add(parts);

      let composer = null, bloom = null;
      if (post) {
        const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = post;
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        // only the emissive traces/LED/label are bright enough to bloom
        bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.35, 0.95);
        composer.addPass(bloom);
        composer.addPass(new OutputPass());
      }

      const resize = () => {
        const r = host.getBoundingClientRect();
        const w = Math.max(1, r.width), h = Math.max(1, r.height);
        renderer.setSize(w, h, false);
        if (composer) composer.setSize(w, h);
        camera.aspect = w / h;
        camera.position.z = w < 500 ? 8 : 6.2;
        camera.position.y = w < 500 ? 6.8 : 5.6;
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
      };
      resize();
      window.addEventListener("resize", resize, { passive: true });
      host.classList.add("is-3d");

      // drag to rotate (horizontal drags only on touch, so vertical scrolling still works)
      let dragging = false, lastX = 0, lastY = 0, yawV = 0, pitch = 0.0, yaw = -0.5;
      canvas.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); KOBE.sfx && KOBE.sfx("grab"); });
      canvas.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        yawV = dx * 0.008;
        yaw += yawV;
        if (!isTouch) pitch = Math.max(-0.35, Math.min(0.5, pitch + dy * 0.004));
      });
      const end = () => { dragging = false; };
      canvas.addEventListener("pointerup", end);
      canvas.addEventListener("pointercancel", end);

      let visible = true;
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(host);
      const clock = new THREE.Clock();
      const loop = () => {
        requestAnimationFrame(loop);
        if (!visible || document.hidden) return;
        const t = clock.getElapsedTime();
        if (!dragging) { yawV *= 0.95; yaw += yawV + (reduceMotion ? 0 : 0.0025); }
        const m = KOBE.mouse || { x: 0, y: 0 };
        const r = host.getBoundingClientRect();
        const nx = ((m.x - r.left) / r.width - 0.5), ny = ((m.y - r.top) / r.height - 0.5);
        pivot.rotation.y = yaw;
        pivot.rotation.x += ((dragging ? pitch : pitch + ny * 0.25) - pivot.rotation.x) * 0.08;
        pivot.rotation.z += ((dragging ? 0 : -nx * 0.12) - pivot.rotation.z) * 0.08;
        pivot.position.y = reduceMotion ? 0 : Math.sin(t * 1.1) * 0.08;

        const pulse = reduceMotion ? 0.8 : 0.55 + 0.45 * Math.sin(t * 2.4);
        traceMats.forEach((mt, i) => { mt.emissiveIntensity = (i === 0 ? 3.2 : 1.8) * (0.55 + pulse * 0.6); });
        ledMats.forEach((mt) => { mt.emissiveIntensity = reduceMotion || Math.sin(t * 6) > 0.2 ? 6 : 0.4; });

        for (let i = 0; i < PART; i++) {
          const [a0, rad, hgt, spd] = seeds[i];
          const a = a0 + t * spd * 0.4;
          pp[i * 3] = Math.cos(a) * rad - 0.35;
          pp[i * 3 + 1] = 0.15 + hgt + Math.sin(t * spd + a0) * 0.12;
          pp[i * 3 + 2] = Math.sin(a) * rad * 0.8;
        }
        pGeo.attributes.position.needsUpdate = true;

        if (composer) composer.render(); else renderer.render(scene, camera);
      };
      loop();
    }
  }
})();
