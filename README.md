# Kobe Orteza — AI Portfolio

A futuristic portfolio built with plain HTML, CSS and JavaScript (no framework, no build step):

- **Hologram**: your portrait, cut out of its background with Apple Vision, shown as a crisp cyan duotone with thousands of glowing `0`/`1` bits on top. The bits rain down and lock into place. Every ~7 seconds (and on hover) the photo "decodes" to full clarity. Click to scatter the bits.
- **Real 3D (three.js + Blender)**: a GPU "data ocean" of ~32k points with a floating wireframe neural core forms the page background and shifts colour as you scroll. The hardware section has a 3D **ES9038Q2M DAC board modelled in Blender** (`tools/blender/dac_board.py`), with glowing traces, bloom, and drag-to-rotate.
- **Sound design**: every sound is synthesized live with Web Audio (no audio files). It covers boot, hover ticks, clicks, typing, a note per agent, section-deploy chords, a build-complete arpeggio, the hologram scatter, and chat sounds, over a quiet ambient pad. Off by default, with a "turn on" prompt after boot.
- **AI builder swarm**: four colour-coded agents (`kobe.ai` architect, `pixel.agent` styles, `neuron.agent` logic, `vector.agent` motion) build the page as you scroll. They claim components from a shared queue, type headings, draw blueprint wireframes, fire curved build beams, leave comet trails, and post toasts. They move with spring physics (frame-rate independent), so they glide and tilt instead of jittering. A live roster in the build log shows what each one is doing. On the hero they orbit and "scan" your hologram. Builds are continuous and scrubbed by scroll on every device (phones and tablets too, with compact tags): each component fades, rises and renders top-down while an agent traces its outline. Scrolling back up un-builds it just as smoothly.
- **HUD + effects**: viewport HUD frame (section, scroll Y, FPS, clock, scroll ruler), perspective grid floor, aurora, cursor spotlight grid, animated conic glow borders, giant parallax section numbers, counter-scrolling marquees, click shockwaves, reticle cursor.
- **kobe.ai chat**: ask anything about Kobe. Answers stream from Claude through a Cloudflare Worker, and the chat falls back to instant offline answers if the worker isn't set up.
- Boot sequence, neural-network background, skill constellation, self-drawing timeline, cursor particle trail, optional UI sounds.
- Responsive. Respects `prefers-reduced-motion`, where everything is shown already built.

## Run it locally

Open `index.html` directly, or (recommended) serve the folder:

```bash
python3 -m http.server 5173
```

Then visit http://localhost:5173.

## Files

| File | What it does |
|---|---|
| `index.html` | Page content + `KOBE_CONFIG` (chat endpoint) |
| `styles.css` | Base design system (colors, layout, project visuals) |
| `ai.css` | Futuristic layer: boot, hologram, AI builder, chat |
| `fx.css` | Agent swarm, HUD frame, glow borders, grid floor, marquees, 3D/sound UI, performance and device tuning |
| `knowledge.js` | **Everything the AI knows about you.** Edit this to update answers. |
| `js/sfx.js` | Sound engine (synthesized Web Audio) |
| `js/scene3d.js` | three.js background + 3D DAC board (loads three from jsDelivr) |
| `assets/kobe-holo.png` | Generated cut-out duotone portrait |
| `assets/3d/dac-board.glb` | 3D board exported from Blender |
| `tools/blender/dac_board.py` | Blender script that models the DAC board |
| `js/main.js` | Boot, nav, cursor, tilt, decode text, role typer, counters, sound |
| `js/hologram.js` | Binary hologram renderer |
| `js/hologram-data.js` | Generated brightness + cut-out mask of your photo |
| `js/ai-builder.js` | The AI agent swarm that builds the page on scroll |
| `js/neural-bg.js` | Neural network background |
| `js/effects.js` | Skill constellation, timeline, EQ bars, HUD readouts, spotlight, cursor trail, shockwaves |
| `js/chat.js` | Chat UI, streaming, offline answers |
| `worker/` | Cloudflare Worker that talks to Claude |
| `tools/make-hologram.swift` | Regenerates the hologram from a photo |

## Turn on the real AI chat (Cloudflare Worker)

You need a free Cloudflare account and an Anthropic API key (https://console.anthropic.com).

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler deploy
```

Paste the key when `secret put` asks for it. The key is stored as an encrypted Cloudflare secret and never appears in your website's code.

`deploy` prints a URL like `https://kobe-ai-chat.<you>.workers.dev`. Put it in `index.html`:

```js
window.KOBE_CONFIG = {
  chatEndpoint: "https://kobe-ai-chat.<you>.workers.dev"
};
```

Then lock the worker to your site: in `worker/wrangler.toml` set `ALLOWED_ORIGINS` to your real site URL (e.g. `"https://kobeorteza.vercel.app"`) and deploy again.

Notes:
- Model: `claude-haiku-5-5` (fast and cheap for a chatbot). Change `MODEL` in `worker/src/index.js` if you want another one.
- Rate limiting: a best-effort 20 questions/minute per visitor is built in. For a hard limit, uncomment the `[[ratelimits]]` block in `wrangler.toml`.
- The worker reads `../knowledge.js` when you deploy, so **redeploy after editing it**.
- Test locally with `npx wrangler dev`, then set `chatEndpoint` to `http://localhost:8787`.

## Rebuild the 3D board (Blender)

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/blender/dac_board.py -- "$PWD/assets/3d/dac-board.glb"
```

Add `--preview preview.png` to also render a still. Materials named `Trace`, `CopperTrace` and `LED` are animated on the website.

## Performance and devices

- The 3D background drops its own resolution if the frame rate falls. Phones and low-end devices get fewer points and no bloom.
- Every animation pauses when it's off-screen or the tab is hidden.
- Smooth inertial scrolling (Lenis, from jsDelivr) on mouse/trackpad; touch devices keep native scrolling.
- Below 800px wide, the agents switch to compact tags; the HUD frame, spotlight and noise layer are turned off, and the chat opens as a full-width bottom sheet that respects iPhone safe areas.
- `prefers-reduced-motion` shows everything already built and static.
- With no WebGL, or no internet for the three.js CDN, the page falls back to the 2D neural background and the CSS chip.
- The 3D board needs the site served over http(s) (`python3 -m http.server`). Opened as a plain file, the CSS chip is shown instead.

## Update what the AI says about you

Edit `knowledge.js`. Keep everything after `window.KOBE_KB =` valid JSON (double quotes, no trailing commas). The `offline_answers` list powers the instant answers when the worker isn't connected.

## Replace the photo

The hologram is generated from `assets/kobe.jpg` using Apple's Vision framework to cut you out of the background (macOS only):

```bash
swift tools/make-hologram.swift assets/kobe.jpg js/hologram-data.js 180 2.6 assets/kobe-holo.png
```

It detects your face and crops in around it. The last number is the zoom: the crop width as a multiple of your face width. Lower is closer (2.2 is very tight; 3.2 shows more shoulders).

A portrait with even lighting and your face clearly visible works best.

## TODO before publishing

- [ ] Replace the placeholder **Email / GitHub / LinkedIn / CV** links in the Contact section of `index.html` (search for `data-placeholder`). Give each link a real `href` and delete its `data-placeholder` attribute.
- [ ] Deploy the worker and set `chatEndpoint`
- [ ] Set `ALLOWED_ORIGINS` to your real domain
- [ ] Deploy the site (Vercel or Cloudflare Pages: just upload this folder, minus `worker/` and `tools/`)
