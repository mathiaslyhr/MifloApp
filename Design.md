# Design Guideline — Gradient / Glass

A reusable brand system for building **smooth, clean, modern** websites and apps.
Light pastel gradient canvases · dark ink · liquid glass · one touch‑first interaction model.

Everything below is portable: raw values (hex / rgba / px / cubic‑bezier) are the source of
truth, with copy‑paste **Tailwind v4 + React** snippets for the web. For native (SwiftUI /
React Native) use the raw values directly.

> Stack this was distilled from: Next.js (App Router) · React · Tailwind CSS v4 (CSS‑first,
> tokens in `globals.css @theme`) · Satoshi via `next/font/local`.

---

## 1. Principles

1. **Light canvas, dark ink.** Backgrounds are soft pastel *mesh gradients* on a near‑white
   base. Text is one near‑black ink (`#0d0d16`) at varying opacity. High legibility, calm feel.
2. **Real glass, not chrome.** Surfaces are translucent white with a thin bright rim, and they
   **refract** the gradient behind them at the edges (a per‑element displacement map — see
   §5b), staying flat/readable in the centre. The gradient glows through; the edges bend it.
3. **Touch‑first, press‑driven.** Feedback happens on *press*, not hover (a phone has no
   hover). One rule for every control, identical on tap and click. On desktop, hover makes the
   glass gently *swell* (intensifying the refraction).
4. **Motion with restraint.** Animate only `transform`, `opacity`, `box-shadow`. Keep UI
   motion ≤ 200 ms, use custom easing, and always honour `prefers-reduced-motion`.
5. **Coherence over variety.** Every control shares the same radius language (pills + soft
   cards), the same press feedback, the same glass rim. Consistency *is* the polish.

---

## 2. Typography

**Typeface:** [Satoshi](https://www.fontshare.com/fonts/satoshi) — only **Regular (400)** and
**Medium (500)**. Never bold; emphasis comes from size and color, not weight.

```tsx
// next/font/local — exposes the CSS var --font-satoshi
import localFont from "next/font/local";
const satoshi = localFont({
  src: [
    { path: "./Satoshi-Regular.otf", weight: "400" },
    { path: "./Satoshi-Medium.otf",  weight: "500" },
  ],
  variable: "--font-satoshi",
});
// font-family: var(--font-satoshi), ui-sans-serif, system-ui, sans-serif;
```

**Type scale** (all headings `font-medium tracking-tight`):

| Role | Size | Line height | Tracking | Example use |
|---|---|---|---|---|
| **Hero** | `clamp(3.5rem, 15vw, 13rem)` | `0.92` | tight | Full‑bleed wordmark |
| **Display / H2** | `clamp(2.5rem, 7vw, 5rem)` | `1.02` | tight | Section headline |
| **Body** | `1rem` → `1.125rem` (`text-base sm:text-lg`) | `relaxed` (~1.625) | normal | Paragraphs |
| **Eyebrow** | `0.75rem` (`text-xs`) | normal | `0.2em`, **UPPERCASE** | Kicker above headline |
| **Label** | `0.875rem` (`text-sm`) | normal | `wide` (`0.025em`) | Corner labels, nav |
| **Card title** | `0.875rem` (`text-sm`) `font-medium` | normal | — | Card headers |
| **Stat number** | `1.5rem` (`text-2xl`) `font-medium` | normal | — | Metrics |
| **Caption / meta** | `0.75rem`–`0.6875rem` | normal | — | Sub‑labels, timestamps |

**Ink & opacity ramp** — one color, many roles:

| Token | Value | Use |
|---|---|---|
| Ink | `#0d0d16` | Headlines, primary text, solid buttons |
| Ink 75% | `#0d0d16` / `0.75` | Card body text |
| Ink 70% | `#0d0d16` / `0.70` | Ghost button text |
| Ink 55% | `#0d0d16` / `0.55` | Body copy, labels |
| Ink 50% | `#0d0d16` / `0.50` | Captions / meta |
| Ink 45% | `#0d0d16` / `0.45` | Eyebrows, hints |

```tsx
<p className="text-xs font-medium uppercase tracking-[0.2em] text-[#0d0d16]/45">Eyebrow</p>
<h2 className="font-medium leading-[1.02] tracking-tight text-[#0d0d16]"
    style={{ fontSize: "clamp(2.5rem,7vw,5rem)" }}>Headline</h2>
<p className="text-base leading-relaxed text-[#0d0d16]/55 sm:text-lg">Body copy…</p>
```

---

## 3. Color

### Core

| Token | Value | Use |
|---|---|---|
| **Ink** | `#0d0d16` | Text, solid surfaces |
| **White surface** | `#ffffff` at 40–55% | Glass fills |
| **White rim** | `#ffffff` at 55–70% | Glass borders / hover rim |
| **Accent** | `#6260f6` | Brand purple — bloom on hover, badges, Lilac |
| **Success** | `#32c36c` | Positive status (toasts, ticks) |

### Gradient palettes (the "colors")

Each palette is **one hue in four tints** over a light base — monochrome, calm, never a
rainbow. Base is a `linear-gradient`; the four values are the blurred blobs (see §4).

| Name | Mood / use | Base | Blobs (rgba) |
|---|---|---|---|
| **Lilac** | Signature brand purple. Hero / the droplet scene. | `linear-gradient(180deg,#ffffff 0%,#f5f2fc 55%,#ece4fb 100%)` | `98,96,246,.35` · `122,120,248,.24` · `98,96,246,.40` · `150,140,250,.22` |
| **Rose** | Soft romantic pink. Warm, friendly. | `linear-gradient(160deg,#fdf0f4 0%,#fff7f9 52%,#fbe7f0 100%)` | `244,169,204,.60` · `248,190,214,.50` · `235,128,178,.45` · `250,206,224,.52` |
| **Coral** | Warm salmon/red. Energetic, inviting. | `linear-gradient(160deg,#fdeee7 0%,#fff6f2 50%,#fce4da 100%)` | `246,158,138,.58` · `249,182,158,.50` · `240,126,104,.44` · `251,204,186,.52` |
| **Peach** | Apricot warmth. Soft, optimistic. | `linear-gradient(160deg,#fdf1e6 0%,#fff8f0 52%,#fbe6d4 100%)` | `248,196,150,.58` · `250,212,178,.50` · `244,168,116,.44` · `252,222,194,.52` |
| **Sand** | Amber / cream. Editorial, premium, neutral‑warm. | `linear-gradient(160deg,#fdf3e2 0%,#fbf6ec 52%,#f6e9d4 100%)` | `247,214,170,.60` · `245,205,180,.50` · `244,210,200,.45` · `248,228,190,.50` |
| **Butter** | Soft yellow. Cheerful, light. | `linear-gradient(160deg,#fdf8e4 0%,#fffdf2 52%,#f8f0cf 100%)` | `246,224,150,.58` · `250,236,178,.50` · `238,208,116,.42` · `252,242,200,.52` |
| **Mint** | Green‑teal. Fresh, calm, "success". | `linear-gradient(160deg,#ecf8f2 0%,#f7fdfa 52%,#e0f2ea 100%)` | `150,224,196,.55` · `180,232,214,.50` · `110,208,178,.44` · `198,238,224,.52` |
| **Sky** | Airy blue. Clean, trustworthy, techy. | `linear-gradient(160deg,#eaf3fc 0%,#f6fbff 52%,#dfecfb 100%)` | `150,200,245,.55` · `182,216,248,.50` · `110,176,240,.44` · `202,226,250,.52` |
| **Periwinkle** | Indigo‑violet. Dreamy, modern; pairs with glass. | `linear-gradient(160deg,#edecfc 0%,#f6f5ff 52%,#e4e4fb 100%)` | `150,148,240,.55` · `182,180,246,.50` · `120,116,234,.42` · `202,200,250,.52` |

**Choosing one:** warm & editorial → Sand / Peach / Butter · brand & hero → Lilac / Periwinkle
· fresh → Mint / Sky · friendly → Rose / Coral. One palette per screen/section.

### The two UI treatments — Clean & Glass

Not hues — the two ways to place UI **on top of** a gradient:

- **Clean** — solid / editorial. Dark ink type + a **solid dark** primary button + an outline
  secondary. Minimal, high‑contrast. Best for hero / landing sections. (Pairs well with Sand.)
- **Glass** — liquid glass. Translucent surfaces that **refract** the gradient at their edges
  (per‑element displacement map, §5b) with a thin bright rim; readable centre. Glass buttons,
  chips, cards, toggles, sliders. Depth and shine. Best for product UI / component clusters.
  (Pairs well with Lilac / Periwinkle.)

You can mix them, but keep one treatment dominant per section.

---

## 4. Gradient engine

**Recipe:** a light `linear-gradient` base + **four** large, heavily‑blurred, rounded blobs
pinned to the corners, each a tint of the same hue, drifting slowly and out of phase.

- Blob size: `34–52vmax`. Blur: `120px` (one at `130px` for variety).
- To create a **new palette**: pick a hue, make 4 tints light→saturated, drop them on a
  base that goes `light tint → near‑white → slightly deeper tint`.

```tsx
// Blob = colour + size + corner position + blur
type Blob = { c: string; s: React.CSSProperties };
type Palette = { name: string; base: string; blobs: Blob[] };

const b = (c: string, size: string, pos: React.CSSProperties, blur = 120): Blob => ({
  c, s: { width: size, height: size, filter: `blur(${blur}px)`, ...pos },
});

// "one hue, four tints across the corners"
const mono = (name: string, base: string, cs: string[]): Palette => ({
  name, base,
  blobs: [
    b(cs[0], "46vmax", { left: "-8%",  top: "-6%" }),
    b(cs[1], "40vmax", { right: "-6%", top: "8%" }, 130),
    b(cs[2], "48vmax", { bottom: "-10%", left: "40%" }),
    b(cs[3], "34vmax", { bottom: "2%",  left: "6%" }),
  ],
});

const Sand = mono("Sand", "linear-gradient(160deg,#fdf3e2 0%,#fbf6ec 52%,#f6e9d4 100%)", [
  "rgba(247,214,170,0.60)", "rgba(245,205,180,0.50)",
  "rgba(244,210,200,0.45)", "rgba(248,228,190,0.50)",
]);

function MeshGradient({ palette }: { palette: Palette }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: palette.base }} />
      {palette.blobs.map((bl, i) => (
        <div key={i} className="drop-blob absolute rounded-full"
          style={{ background: bl.c, ...bl.s,
            animationDuration: `${18 + i * 3}s`,   // 18s, 21s, 24s, 27s
            animationDelay:    `${-i * 4}s` }} />   // staggered, out of phase
      ))}
    </div>
  );
}
```

```css
@keyframes dropDrift {
  0%,100% { transform: translate3d(0,0,0) scale(1); }
  50%     { transform: translate3d(3%, -3%, 0) scale(1.08); }
}
.drop-blob {
  animation-name: dropDrift;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}
@media (prefers-reduced-motion: reduce) { .drop-blob { animation: none; } }
```

The gradient sits `absolute inset-0` behind content; it fills the whole viewport/section.

---

## 5. Interaction system (touch‑first, Apple‑style)

**Philosophy:** press, not hover. All *activation* feedback happens on `:active` — it works
identically on tap (phone) and click (desktop). Hover is a desktop‑only enhancement, gated by
`@media (hover:hover)` (which Tailwind's `hover:` already applies). Selection is shown by a
sliding thumb; text fields use **focus**, not hover.

**The shared class strings** (compose onto every control):

```tsx
// Press: scale down + slight dim on press, gentle spring‑back. Works on touch + click.
const PRESS_BASE =
  "tap cursor-pointer select-none touch-manipulation " +
  "transition-transform duration-200 " +
  "ease-[cubic-bezier(0.34,1.25,0.64,1)] active:scale-[0.96] active:opacity-90";

// Hover (desktop only): the glass SWELLS — scaling up grows its backdrop sampling
// so the refraction intensifies. Uniform, no lift, no colour shift.
const GLASS_HOVER = "hover:scale-[1.03]";

const CTRL = `${PRESS_BASE} ${GLASS_HOVER}`;   // ← put this on every button/chip/toggle/thumb
```

```css
/* Clean taps on mobile — no grey flash. */
.tap { -webkit-tap-highlight-color: transparent; }
```

Raw equivalent (for native / non‑Tailwind):

```css
.control {
  cursor: pointer; user-select: none; touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: transform 200ms cubic-bezier(0.34,1.25,0.64,1), opacity 200ms;
}
.control:active           { transform: scale(0.96); opacity: 0.90; }   /* press */
@media (hover:hover) {
  .control:hover          { transform: scale(1.03); }                  /* glass swells */
}
```

- **Focus (keyboard/tap):** keep a visible focus ring — accent outline:
  `:focus-visible { outline: 2px solid #6260f6; outline-offset: 2px; }`
- **Pure‑press fallback:** don't want the hover swell? Set `const CTRL = PRESS_BASE;`
  (drop `GLASS_HOVER`). Now feedback is press‑only — the most iOS‑like option.

---

## 5b. Liquid Glass (real refraction)

The signature surface. Instead of a flat frosted blur, each glass element **refracts** the
gradient behind it through an SVG displacement map. The map is a **rounded‑rect bevel**:
neutral/flat in the centre (so text stays sharp) and curving only near the edges — and it is
**generated per element to match that element's exact size + corner radius**, so it works for
circles, pills and cards without ever looking boxy.

> **Browser support:** `backdrop-filter: url(#svg)` refracts in **Chromium** (Chrome/Edge/Arc).
> **Safari/Firefox** don't support SVG‑url backdrop filters → they gracefully keep the `blur()`
> fallback (frosted, no bending). Same limitation as the original CodePen technique.

**Surface CSS** — clear fill + a bright rim that follows the element's `border-radius`:

```css
.lg-surface {
  background: rgba(255,255,255,0.10);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.6),      /* bright rim, follows radius */
              0 16px 32px -10px rgba(20,15,50,0.18); /* soft lift shadow */
}
.lg-surface--light { background: rgba(255,255,255,0.05); }  /* fainter fill (outline look) */
```

**The filter** (rendered per element; `id` is unique per instance):

```tsx
<filter id={id} primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
  <feImage href={mapDataURL} preserveAspectRatio="none" x="0" y="0" width="1" height="1" result="map"/>
  <feGaussianBlur in="SourceGraphic" stdDeviation="0.01" result="blur"/>
  <feDisplacementMap in="blur" in2="map" scale={scale} xChannelSelector="R" yChannelSelector="G"/>
</filter>
```

**Build the bevel displacement map** (rounded‑rect SDF → quarter‑circle bevel → normal map):

```ts
// Neutral (128,128) in the centre; RG encode the surface normal near the edges.
function buildBevelMap(w: number, h: number, radius: number, band: number): string {
  const k = Math.min(1, 200 / Math.max(w, h));           // cap resolution for perf
  const W = Math.max(8, Math.round(w * k)), H = Math.max(8, Math.round(h * k));
  const rr = Math.min(radius * k, W / 2, H / 2), b = Math.max(2, band * k);
  const cx = W / 2, cy = H / 2;

  const edgeDist = (x: number, y: number) => {           // >0 inside, distance to edge
    const qx = Math.abs(x - cx) - (W / 2 - rr), qy = Math.abs(y - cy) - (H / 2 - rr);
    const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
    return -(out + Math.min(Math.max(qx, qy), 0) - rr);
  };
  const height = (x: number, y: number) => {             // 0 at edge → 1 across the band
    const d = edgeDist(x, y); if (d <= 0) return 0;
    const t = Math.min(1, d / b); return Math.sqrt(1 - (1 - t) * (1 - t));
  };

  const gx = new Float32Array(W * H), gy = new Float32Array(W * H); let max = 1e-6;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = height(x + 1, y) - height(x - 1, y), dy = height(x, y + 1) - height(x, y - 1);
    gx[y * W + x] = dx; gy[y * W + x] = dy;
    max = Math.max(max, Math.abs(dx), Math.abs(dy));
  }
  const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d"); if (!ctx) return "";
  const img = ctx.createImageData(W, H), d = img.data, amp = 120 / max;
  for (let i = 0, p = 0; i < W * H; i++) {
    d[p++] = Math.max(0, Math.min(255, Math.round(128 - gx[i] * amp)));
    d[p++] = Math.max(0, Math.min(255, Math.round(128 - gy[i] * amp)));
    d[p++] = 128; d[p++] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}
```

**The hook** — measures the element and wires up the filter + backdrop:

```tsx
function useLiquidGlass<T extends HTMLElement>(scale = 0.32) {
  const ref = useRef<T | null>(null);
  const filterId = "lg-" + useId().replace(/[:ε]/g, "");
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    let raf = 0;
    const rebuild = () => {
      const r = el.getBoundingClientRect();
      const w = Math.round(r.width), h = Math.round(r.height);
      if (w < 4 || h < 4) return;
      let radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      radius = Math.min(radius, Math.min(w, h) / 2);
      const band = Math.min(Math.min(w, h) * 0.3, 14);   // thin edge band → readable centre
      setHref(buildBevelMap(w, h, radius, band));
    };
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(rebuild); });
    ro.observe(el); rebuild();
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  const style: CSSProperties = {
    backdropFilter: href ? `blur(1px) url(#${filterId})` : "blur(6px)", // Chromium: refraction
    WebkitBackdropFilter: "blur(6px)",                                   // Safari: frosted only
  };
  const filter = href ? (
    <svg width="0" height="0" aria-hidden style={{ position: "absolute" }}>
      <filter id={filterId} primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
        <feImage href={href} preserveAspectRatio="none" x="0" y="0" width="1" height="1" result="map"/>
        <feGaussianBlur in="SourceGraphic" stdDeviation="0.01" result="blur"/>
        <feDisplacementMap in="blur" in2="map" scale={scale} xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </svg>
  ) : null;

  return { ref, style, filter };
}
```

**Usage** — put `.lg-surface` on any element, spread the style, drop the filter as a sibling:

```tsx
const { ref, style, filter } = useLiquidGlass<HTMLButtonElement>();
return (<>
  <button ref={ref} style={style} className={`${CTRL} lg-surface rounded-full px-5 py-2.5 …`}>Open</button>
  {filter}
</>);
```

**Tunables:** `scale` — displacement strength (`0.28` cards · `0.32` default · `0.5` slider);
`band` — edge‑refraction width; the `200` resolution cap. Bigger `scale`/`band` = more bending
(and less readable centre), so keep them modest on text surfaces.

---

## 6. Components

Four button variants — all pills (`rounded-full`), all carry `CTRL`:

| Variant | Look | Use |
|---|---|---|
| **Solid** | Solid dark ink | Primary CTA |
| **Glass** | Full liquid‑glass surface | Secondary action |
| **Outline** | Lighter glass fill; rim reads as an outline | Tertiary |
| **Ghost** | Invisible until hover, where a faint fill appears | Low‑emphasis / dismiss |

```tsx
// Primary — solid ink (not glass; a crisp white hairline rim + lift shadow)
<button className={`${CTRL} rounded-full bg-[#0d0d16] px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_0_1.5px_rgba(255,255,255,0.25),0_14px_30px_-12px_rgba(20,15,50,0.4)]`}>Get started</button>

// Glass — full liquid glass (useLiquidGlass, see §5b)
const { ref, style, filter } = useLiquidGlass<HTMLButtonElement>();
<><button ref={ref} style={style} className={`${CTRL} lg-surface rounded-full px-5 py-2.5 text-sm font-medium text-[#0d0d16]`}>Open</button>{filter}</>

// Outline — same glass, lighter fill (rim reads as an outline)
<><button ref={ref} style={style} className={`${CTRL} lg-surface lg-surface--light rounded-full px-5 py-2.5 text-sm font-medium text-[#0d0d16]`}>Learn more</button>{filter}</>

// Ghost — invisible until hover, where a faint fill appears
<button className={`${CTRL} rounded-full px-5 py-2.5 text-sm font-medium text-[#0d0d16]/70 hover:bg-white/25`}>Skip</button>
```

**GlassCard** — a liquid‑glass panel (`useLiquidGlass`, softer `scale=0.28`):

```tsx
const { ref, style, filter } = useLiquidGlass<HTMLDivElement>(0.28);
<><div ref={ref} style={style} className="lg-surface rounded-3xl p-6">…</div>{filter}</>
```

**Chip** (tappable tag) — `CTRL` + liquid‑glass pill:

```tsx
const { ref, style, filter } = useLiquidGlass<HTMLSpanElement>();
<><span ref={ref} style={style} className={`${CTRL} lg-surface inline-block rounded-full px-3 py-1 text-xs font-medium text-[#0d0d16]/80`}>Design</span>{filter}</>
```

**Badge** (status/verified dot):

```tsx
<span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#6260f6] text-[9px] text-white">✓</span>
// success variant: bg-[#32c36c]
```

**Avatar / AvatarStack** — 2px white ring, gradient fill, overlapped:

```tsx
<div className="flex -space-x-2.5">{/* each: */}
  <div className="h-9 w-9 rounded-full border-2 border-white/80 shadow-sm"
       style={{ background: "linear-gradient(135deg,#b294f0,#cbb7f5)" }} />
</div>
```

**Toggle** — liquid‑glass track with a sliding thumb (thumb = selection, options carry `CTRL`):

```tsx
const { ref, style, filter } = useLiquidGlass<HTMLDivElement>();
<><div ref={ref} style={style} className="lg-surface relative flex rounded-full p-1">
  <div aria-hidden
    className="absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-full bg-white/85 shadow-[0_2px_8px_-2px_rgba(20,15,50,0.35)]
               transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
    style={{ transform: `translateX(${active * 100}%)` }} />
  {options.map((o, i) => (
    <button key={o} onClick={() => setActive(i)}
      className={`${CTRL} relative z-10 w-24 rounded-full py-1.5 text-xs font-medium
        ${active === i ? "text-[#0d0d16]" : "text-[#0d0d16]/55"}`}>{o}</button>
  ))}
</div>{filter}</>
```

**Field** — liquid‑glass wrapper; the `<input>` keeps the caret, send button uses `CTRL`:

```tsx
const { ref, style, filter } = useLiquidGlass<HTMLDivElement>();
<><div ref={ref} style={style} className="lg-surface flex items-center gap-2 rounded-full p-1.5 pl-4">
  <input className="bg-transparent text-sm text-[#0d0d16] placeholder:text-[#0d0d16]/45 focus:outline-none" placeholder="you@studio.com" />
  <button className={`${CTRL} rounded-full bg-[#0d0d16] px-4 py-1.5 text-xs font-medium text-white`}>Notify me</button>
</div>{filter}</>
```

**Slider** — liquid‑glass track + ink fill + a bright thumb that *presses* on grab (scale 0.9).
Driven by pointer events with `setPointerCapture` on the track (reuse the glass `ref`);
`touch-none` so dragging doesn't scroll the page.

```tsx
const { ref, style, filter } = useLiquidGlass<HTMLDivElement>(0.5);
<><div ref={ref} style={style} onPointerDown={…} onPointerMove={…} onPointerUp={…}
     className="lg-surface tap relative h-2.5 w-[180px] cursor-pointer touch-none select-none rounded-full">
  <div className="absolute inset-y-0 left-0 rounded-full bg-[#0d0d16]/55" style={{ width: `${val}%` }} />
  <div className="absolute top-1/2 h-5 w-5 rounded-full bg-white shadow-[0_0_0_1.5px_rgba(255,255,255,0.55),0_2px_8px_-2px_rgba(20,15,50,0.4)]"
       style={{ left: `${val}%`, transform: `translate(-50%,-50%) scale(${grabbing ? 0.9 : 1})` }} />
</div>{filter}</>
```

**Eyebrow** `text-xs font-medium uppercase tracking-[0.2em] text-[#0d0d16]/45` ·
**Corner label** `text-sm font-medium tracking-wide text-[#0d0d16]/55`.

---

## 7. Layout & scroll

Full‑screen sections that **snap** — the scroll settles itself onto each screen.

```tsx
// Scroll container — a self‑contained, full‑viewport snap surface
<main className="fixed inset-0 snap-y snap-mandatory overflow-y-auto overflow-x-hidden bg-white">
  <section className="relative h-full w-full snap-start overflow-hidden">
    <MeshGradient palette={Lilac} />
    {/* content… */}
  </section>
  {/* more sections… */}
</main>
```

- **Snap:** container `snap-y snap-mandatory`; each section `h-full snap-start`. Scroll
  "clicks" onto whole screens.
- **Performance:** off‑screen sections get `content-visibility: auto` +
  `contain-intrinsic-size: 100vw 100vh` so their heavy blurs don't paint until near view.
  *(Skip this on sections that use `backdrop-filter`.)*
- **Corner label** (top‑left) names each screen: `absolute left-8 top-8 …`.
- **Scroll hint** — a gentle bobbing "scroll ↓" on the first screen:

```css
@keyframes scrollHint { 0%,100%{ transform: translate(-50%,0); opacity:.45 } 50%{ transform: translate(-50%,4px); opacity:.8 } }
.scroll-hint { animation: scrollHint 2.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .scroll-hint { animation: none; } }
```

---

## 8. Signature — the liquid‑glass droplet (optional flair)

A hero flourish: a glass drop that follows the cursor and **magnifies + refracts** the content
beneath it. Technique, for when you want the wow moment:

- **Real magnification:** a duplicated, scaled copy of the scene inside a circular
  `overflow-hidden` lens (magnifier math), not just a blur.
- **Liquid refraction:** an SVG filter — `feTurbulence` → `feDisplacementMap` (+ a touch of
  `feGaussianBlur`) applied to the small lens for organic edge melt.
- **Wet glass shading:** layered radial gradients (tight specular highlight top‑left, faint
  environment reflection, soft bottom‑weighted Fresnel rim, chromatic green↔magenta dispersion
  on the lower edge) + a soft contact shadow. No hard white outline — feather the edge with a
  radial `mask`.
- **Motion:** dependency‑free `requestAnimationFrame` lerp so it follows with momentum and
  grows slightly while moving. Key constants: `SIZE 140px`, `ZOOM 1.55`, `follow 0.18`.
- **Guards:** gate behind `@media (hover:hover) and (pointer:fine)` (hide on touch),
  `pointer-events-none`, and honour reduced‑motion.

---

## 9. Motion & easing

| Token | Curve | Use |
|---|---|---|
| **Ease‑out‑quint** | `cubic-bezier(0.22, 1, 0.36, 1)` | Slides, reveals, the toggle thumb, entrances |
| **Spring back‑out** | `cubic-bezier(0.34, 1.25, 0.64, 1)` | Press feedback (slight overshoot on release) |
| Gradient drift | `ease-in-out`, 18–27 s | Blob movement |

| Interaction | Duration |
|---|---|
| Press / control feedback | 150–200 ms |
| Toggle thumb slide | 200 ms |
| Focus rim | 200 ms |
| Section snap | native |

**Rules:** animate only `transform` / `opacity` / `box-shadow`; keep UI motion ≤ 200 ms;
always add a `@media (prefers-reduced-motion: reduce)` fallback that removes movement.

---

## 10. Foundations & setup

**Radii**

| Element | Value |
|---|---|
| Buttons, chips, inputs, toggles (pills) | `rounded-full` |
| Cards | `rounded-3xl` (24px) · project card token = 16px |
| Small badges | `rounded-full` |

**Blur / glass**

| Use | Value |
|---|---|
| Gradient blobs | `120px` (–`130px`) |
| Liquid‑glass surface (`.lg-surface`) | `backdrop-filter: blur(1px) url(#…)` — the refraction (Chromium); `blur(6px)` fallback (Safari) |
| Glass fill | `rgba(255,255,255,0.10)` (`.lg-surface`) · `0.05` (`--light`) |

The refraction comes from a **per‑element displacement map** (see §5b), not a static blur —
Chromium only, with a `blur()` fallback everywhere else.

**Shadows**

| Use | Value |
|---|---|
| Glass rim + lift (`.lg-surface`) | `0 0 0 1px rgba(255,255,255,0.6), 0 16px 32px -10px rgba(20,15,50,0.18)` |
| Solid button | `0 0 0 1.5px rgba(255,255,255,0.25), 0 14px 30px -12px rgba(20,15,50,0.4)` |
| Avatar / thumb | `0 0 0 1.5px rgba(255,255,255,0.55), 0 2px 8px -2px rgba(20,15,50,0.4)` |

**Tailwind v4 tokens** (`globals.css @theme`) already in this project:

```css
@theme {
  --color-accent: #6260f6;
  --color-success: #32c36c;
  --font-sans: var(--font-satoshi), ui-sans-serif, system-ui, sans-serif;
  --radius-card: 16px;
  --radius-button: 14px;
  --ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);
}
/* Global: respect reduced motion (kills durations/animations). */
@media (prefers-reduced-motion: reduce) { *,*::before,*::after {
  animation-duration:.001ms!important; animation-iteration-count:1!important;
  transition-duration:.001ms!important; } }
```

**Portability:** for SwiftUI / React Native, ignore the Tailwind strings and use the raw
hex / rgba / cubic‑bezier / px values throughout — they define the whole system. The only
web‑specific pieces are `backdrop-filter` (glass) and the SVG droplet filter.

---

*Live reference implementation: `src/app/hover/page.tsx`.*

