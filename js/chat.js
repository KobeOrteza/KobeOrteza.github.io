/* chat.js — "Ask Kobe's AI". Streams answers from the Cloudflare Worker when
   KOBE_CONFIG.chatEndpoint is set; otherwise (or on failure) answers offline
   from knowledge.js with keyword matching. */
(() => {
  "use strict";
  const KOBE = window.KOBE || {};
  const KB = window.KOBE_KB || null;
  const endpoint = ((window.KOBE_CONFIG || {}).chatEndpoint || "").trim();

  const orb = document.getElementById("chat-orb");
  const panel = document.getElementById("chat-panel");
  const logEl = document.getElementById("chat-log");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const closeBtn = document.getElementById("chat-close");
  const statusEl = document.getElementById("chat-status");
  const suggest = document.getElementById("chat-suggest");
  if (!panel || !form) return;

  const history = []; // {role, content}
  let busy = false;
  let greeted = false;
  let lastOpener = null;

  if (!endpoint) {
    statusEl.classList.add("offline");
    statusEl.innerHTML = "<i></i> offline mode · instant answers from Kobe's profile";
  }

  /* ---------- Open / close ---------- */
  const open = (question) => {
    lastOpener = document.activeElement;
    panel.hidden = false;
    orb && orb.setAttribute("aria-expanded", "true");
    KOBE.sfx && KOBE.sfx("open");
    if (!greeted) {
      greeted = true;
      botSay("Hi, I'm kobe.ai 👋 Ask me anything about Kobe: his projects, skills, hardware builds, awards, or whether he's open to opportunities.");
    }
    if (question) ask(question);
    else setTimeout(() => input.focus(), 60);
  };
  const close = () => {
    KOBE.sfx && KOBE.sfx("close");
    panel.hidden = true;
    orb && orb.setAttribute("aria-expanded", "false");
    (lastOpener && lastOpener.focus ? lastOpener : orb).focus();
  };

  document.querySelectorAll("[data-open-chat]").forEach((b) => b.addEventListener("click", () => (panel.hidden ? open() : input.focus())));
  document.querySelectorAll("[data-ask]").forEach((b) => b.addEventListener("click", () => open(b.dataset.ask)));
  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) close(); });
  suggest.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => ask(b.textContent)));

  // Nudge: show the orb's label for a moment after boot
  if (orb && KOBE.onBoot) KOBE.onBoot(() => {
    setTimeout(() => orb.classList.add("hint"), 3500);
    setTimeout(() => orb.classList.remove("hint"), 8000);
  });

  /* ---------- Rendering ---------- */
  const scroll = () => { logEl.scrollTop = logEl.scrollHeight; };
  const addMsg = (role, text = "") => {
    const el = document.createElement("div");
    el.className = `msg ${role}`;
    el.textContent = text;
    logEl.appendChild(el);
    scroll();
    return el;
  };
  const showThinking = () => {
    const el = document.createElement("div");
    el.className = "thinking";
    el.setAttribute("aria-label", "kobe.ai is thinking");
    el.innerHTML = '<span class="neurons"><i></i><i></i><i></i><i></i></span> processing';
    logEl.appendChild(el);
    scroll();
    return el;
  };

  /* Typewriter that can be fed while streaming */
  const typewriter = (el) => {
    let queue = "";
    let shown = "";
    let done = false;
    let resolveDone;
    const finished = new Promise((r) => (resolveDone = r));
    const caret = document.createElement("span");
    caret.className = "typing-caret";
    const step = () => {
      if (queue.length) {
        const n = Math.max(1, Math.ceil(queue.length / 12)); // speed up when backlog grows
        shown += queue.slice(0, n);
        queue = queue.slice(n);
        el.textContent = shown;
        el.appendChild(caret);
        scroll();
      }
      if (done && !queue.length) { caret.remove(); el.textContent = shown; resolveDone(shown); return; }
      setTimeout(step, KOBE.reduceMotion ? 0 : 16);
    };
    step();
    return {
      push: (t) => { queue += t; },
      end: () => { done = true; return finished; }
    };
  };

  const botSay = (text) => {
    const tw = typewriter(addMsg("bot"));
    tw.push(text);
    return tw.end();
  };

  /* ---------- Offline brain ---------- */
  const offlineAnswer = (q) => {
    if (!KB) return "I'm offline right now. Use the Contact section below to reach Kobe directly!";
    const text = ` ${q.toLowerCase().replace(/[^\w\sáéíóú²-]/g, " ")} `;
    const hits = (kws) => kws.reduce((s, k) => s + (text.includes(` ${k} `) || (k.length > 4 && text.includes(k)) ? (k.includes(" ") ? 2 : 1) : 0), 0);

    let best = null, bestScore = 0;
    KB.projects.forEach((p) => {
      const s = hits(p.keywords) * 2 + (text.includes(p.name.toLowerCase()) ? 4 : 0);
      if (s > bestScore) { bestScore = s; best = `${p.name} (${p.type}): ${p.summary} Built with ${p.tech.join(", ")}.`; }
    });
    KB.offline_answers.forEach((a) => {
      const s = hits(a.keywords);
      if (s > bestScore) { bestScore = s; best = a.answer; }
    });
    return best || "Good question! I don't have that detail in my notes yet. Kobe would be happy to answer it himself. The Contact section at the bottom of the page is the fastest way to reach him.";
  };

  /* ---------- Online brain (streams from the Worker) ---------- */
  const askOnline = async (tw) => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history.slice(-12) })
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let got = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      got += chunk;
      tw.push(chunk);
    }
    if (!got.trim()) throw new Error("empty response");
    return got;
  };

  /* ---------- Ask ---------- */
  async function ask(raw) {
    const q = String(raw || "").trim().slice(0, 500);
    if (!q || busy) return;
    if (panel.hidden) { open(q); return; }
    busy = true;
    form.querySelector("button").disabled = true;
    addMsg("user", q);
    history.push({ role: "user", content: q });
    KOBE.sfx && KOBE.sfx("send");

    const thinking = showThinking();
    let answer = "";
    if (endpoint) {
      let tw = null;
      try {
        // keep "thinking" up until the first bytes arrive
        const msgEl = document.createElement("div");
        msgEl.className = "msg bot";
        tw = typewriter(msgEl);
        let attached = false;
        const origPush = tw.push;
        tw.push = (t) => {
          if (!attached) { attached = true; thinking.remove(); logEl.appendChild(msgEl); }
          origPush(t);
        };
        await askOnline(tw);
        answer = await tw.end();
      } catch (err) {
        console.warn("kobe.ai backend unavailable, answering offline:", err);
        thinking.remove();
        if (tw) tw.end();
        answer = offlineAnswer(q);
        await botSay(answer);
      }
    } else {
      await new Promise((r) => setTimeout(r, 450 + Math.random() * 400));
      thinking.remove();
      answer = offlineAnswer(q);
      await botSay(answer);
    }
    history.push({ role: "assistant", content: answer });
    KOBE.sfx && KOBE.sfx("receive");
    busy = false;
    form.querySelector("button").disabled = false;
    input.focus();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value;
    input.value = "";
    ask(q);
  });
})();
