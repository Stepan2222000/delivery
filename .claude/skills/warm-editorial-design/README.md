# Warm Editorial Design System

A design system anchored on a **warm cream canvas** with **serif display headlines**, a signature **coral accent**, and **dark slate** product surfaces. The aesthetic is editorial and considered — closer to a literary magazine than a typical SaaS marketing site.

Use this kit to mock interfaces, slides, and prototypes that share this warm/editorial DNA: cream + coral marketing surfaces and dark-slate product surfaces.

> 🚩 **Fonts are public substitutes.** This system uses **Fraunces** (display serif) and **Inter** (sans), with **JetBrains Mono** for code. If you have a licensed serif/sans pair you'd rather use, drop the files into `fonts/` and update `colors_and_type.css`.

---

## Index

| File / folder | What's in it |
|---|---|
| `colors_and_type.css` | All CSS variables (colors, type tokens, radii, spacing, elevation) + semantic role classes (`.display-xl`, `.title-md`, `.body-md`, etc) and surface utilities (`.surface-cream`, `.surface-dark`). **Import this first.** |
| `assets/icons/` | Outline product icons — chat, new-chat, project, character-face, dna, styles, close-panel, sparkle |
| `preview/*.html` | Cards rendered on the Design System tab (colors, type, components) |
| `ui_kits/chat-product/` | Hi-fi recreation of a chat product surface (sidebar, chat thread, composer, character cards, login). `index.html` is a click-thru. |
| `SKILL.md` | Drop-in skill manifest for an agent runtime |

---

## Content fundamentals

The voice is **considered, warm, and unhurried** — closer to a literary essay than a SaaS marketing site.

**Voice & tone**
- **Sentence-case, never title-case.** Headlines read like prose, not like ad copy: "Meet your thinking partner.", "Built to be safe.", "A more capable, considered assistant."
- **Second person, you-first.** "Your work, your decisions." Not "users", not "customers", not "we".
- **Short declarative sentences.** Then a longer follow-up that adds nuance.
- **No marketing superlatives.** Avoid "revolutionary," "best-in-class," "10×". The product talks about itself with restraint: "more capable", "more considered", "useful for".
- **Concrete verbs over abstract ones.** "Draft," "review," "summarise," "decide" — not "leverage," "empower," "unlock."
- **Periods on headlines.** A homepage h1 ending in `.` is the tell.
- **No emoji** in marketing or product UI. Unicode glyphs (→, ↗, ⌘) are fine for navigation cues; emoji are not.
- **Casing rule:** sentence case for everything except a small set of all-caps badges ("NEW", "BETA"). Never SHOUTY MARKETING ALL-CAPS sections.

**Specific copy patterns**
- Hero h1s: short editorial line + period. *"Meet your thinking partner."* / *"Built to be safe."*
- Sub-head: a 1–2 sentence amplification, body sans, muted color.
- CTAs: 2 short verbs max. "Get started" · "Try it free" · "Read the docs" · "Sign in".
- Pricing tier names: literal and small. *Free · Pro · Team · Enterprise* — not *Hobbyist · Hustler · Hero*.
- Product strings: instructional, never breezy. *"Start a new chat"*, *"Use a project"*, *"Connect to Drive"* — never *"Let's go!"* or *"Ready when you are 🎉"*.
- Empty states use a quiet declarative line: *"Nothing here yet. Start a chat to begin."*
- Error strings stay short and human: *"That didn't work — try again in a moment."*

**Don'ts**
- Don't write in title case, don't use exclamation marks, don't use emoji, don't use jargon ("synergize", "leverage"), don't use industry buzz ("AGI", "moat", "10×").
- Don't address the reader as "users" or "customers". *You.*
- Don't promise outcomes ("Become 10× more productive!"). State capabilities. Let the reader infer.

---

## Visual foundations

### Surface trinity
The system runs on **three surfaces** that alternate page-by-page (never two of the same in a row):

1. **Cream canvas** `#FAF9F5` — the default body floor. Warm-tinted, deliberately not cool-white. The signature foundation.
2. **Cream card** `#EFE9DE` — slightly darker cream for feature cards inside cream sections.
3. **Slate / dark** `#181715` (marketing) and `#262625` (product app) — used for code mockups, model-comparison cards, the footer, and the entire product UI.

The cream-to-dark contrast is the page's pacing rhythm. Coral CTAs and full-bleed coral callout cards are the third color, used **scarcely on individual elements and generously only on full-bleed coral bands**.

### Color
- Primary brand: **Coral `#CC785C`** (active `#A9583E`, hover `#B8684E`, disabled `#E6DFD8`). One color, one job: primary CTAs.
- Text on cream: ink `#141413` for headlines, body `#3D3D3A` for paragraphs, muted `#6C6A64` for secondary, muted-soft `#8E8B82` for fine print.
- Text on dark: cream-tinted white `#FAF9F5`, muted alpha `rgba(255,255,255,0.6)` and `0.4`.
- Accents (sparing): teal `#5DB8A6` (status dots), amber `#E8A55A` (category badges), purple `#9B87F5` (Pro plan chip only).
- Semantic: success `#5DB872`, warning `#D4A017`, error `#C64545`/`#BF4D43`, info/focus blue `#207FDE`.
- Imagery is **warm**, never cool — illustrations use coral + dark-navy strokes on cream; photography is rare and skews warm-toned. No blue/purple gradients, no glassmorphism, no neon.

### Type
- **Display:** Fraunces at weight 400, with negative letter-spacing (-0.3 to -1.5 px depending on size). **Never bold** — display weight stays at 400. Negative tracking is non-negotiable.
- **Body / UI:** Inter at weights 400 (paragraphs), 500 (labels, buttons, nav). Humanist proportions only — never geometric, never Helvetica/Arial.
- **Code:** JetBrains Mono at 14px / 1.6 line-height.
- The display↔body split is editorial: serif for the literary voice, sans for the UI utility. Don't cross them.

### Spacing
- 4-base scale: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96`.
- Section rhythm: **96 px between major bands** on marketing surfaces.
- Card internal padding: 32 px for feature/pricing/mockup cards; 24 px for code windows and connector tiles.

### Backgrounds & textures
- **No textures, no grain, no gradients.** Solid color blocks only.
- **No full-bleed photography hero.** When imagery is used, it sits inside a `rounded-xl` card on cream — never bleeding to the edge.
- The dark product surface is solid `#181715` / `#262625` — **not** a gradient, **not** glassmorphism.
- One subtle exception: the coral primary button carries a 1.5 px inset top-light (`inset 0 1.5px 0 rgba(186,111,48,0.5)`) that gives it a slightly pressed-in feel without crossing into skeuomorphism.

### Borders, radii, elevation
- Radii: `4 · 6 · 8 · 12 · 16 · pill`. Buttons and inputs at 8; content cards at 12; the hero illustration container at 16; badges at pill.
- Hairlines: 1 px in `#E6DFD8` on cream surfaces, `#373632` on dark. Borders feel like one-step elevation, not ink lines.
- **Elevation philosophy: flat-first, shadows rare.** Most depth comes from cream-vs-dark surface contrast. The `--shadow-1` and `--shadow-2` tokens exist but are reserved for hover-lift states; default cards are flat.
- No frosted glass, no inner-glow halos, no border-glow focus rings — focus is a 3 px coral-at-15%-alpha outer ring, full stop.

### Animation & motion
- **Restrained.** Default to 150–200 ms ease-out for hover/press, 250–350 ms for entrance. No bounces, no spring overshoot, no parallax.
- Hover on coral primary: darken to `--brand-coral-active`, no scale change.
- Hover on cream secondary: shift bg from `--cream-canvas` to `--cream-card`, hairline darkens slightly.
- Press: no shrink, no scale — just the active color swap.
- Entrance: fade-up 8 px, ease-out, 250 ms — for chat messages and modal cards. Nothing else animates by default.

### Hover & press states
- **Primary CTA:** idle `--brand-coral` → hover `--brand-coral-hover` → active `--brand-coral-active`. No scale, no shadow change.
- **Secondary cream:** idle transparent border `--cream-hairline` → hover bg `--cream-card` → active bg `--cream-strong`.
- **Text link:** idle `--brand-coral`, underline on hover (offset 3 px), no color change.
- **Tabs (cream):** idle `--muted` → hover `--ink` (no bg) → active bg `--cream-card`, text `--ink`.
- **Product (dark) hover:** translucent white at 5–8 % alpha overlay on the same surface. Never lighten the whole card.
- **Disabled:** desaturated cream `--brand-coral-disabled` for the primary button; muted text everywhere else. Disabled stays in the cream family.

### Transparency, blur, layering
- **Almost none.** No backdrop-filter, no glassmorphism.
- The product UI uses translucent white at 5/8/12 % alpha for hover overlays on the dark sidebar — that's the only place transparency is used systematically.
- The system prefers **capsules** (solid pills with hairlines) over gradient-on-image protection. There is no hero-image protection gradient anywhere in the kit.

### Imagery direction
- **Color vibe:** warm cream canvas, dark navy product chrome, coral accent. Cool tones only appear inside syntax highlighting in code blocks.
- **No grain, no film effect.** When photos appear (testimonials), they crop to perfect 40 px circles, no border, no shadow.
- **Illustrations:** simple line-art, coral + dark-navy strokes on cream. Never photorealistic, never 3D-rendered, never "AI-generated marketing splash". Prefer showing actual product chrome (code editor, terminal, chat) over abstract illustrations.

### Layout rules
- Max content width 1200 px; centered.
- Hero: 6/6 split — h1 + sub + buttons left, illustration / mockup card right.
- Feature cards: 3-up desktop, 2-up tablet, 1-up mobile.
- Pricing: 3- or 4-up desktop, 1-up mobile.
- The footer is **always** dark navy and never inverts. The top nav is **always** cream.

---

## Iconography

**Style:** outline icons, **2 px stroke**, rounded line-caps and joins, **24 × 24 viewBox**, currentColor stroke. Aesthetically very close to **Lucide** and **Heroicons (outline)** — humanist, balanced, neutral. Some product icons (the sparkle, the DNA strand, the character face) are **filled glyphs** rather than outlines.

**What we have, in `assets/icons/`:**
- `sparkle.svg` — a generic 4-pointed sparkle, used as a content marker / inline accent
- `chat.svg`, `new-chat.svg`, `project.svg`, `project-folder.svg`, `close-panel.svg` — product navigation icons, outline 2 px stroke
- `character-face.svg`, `dna.svg`, `styles.svg` — product feature icons, filled

**Substitution policy.** When you need an icon not in the kit:
1. **Prefer Lucide** ([lucide.dev](https://lucide.dev)) — it matches the existing kit's stroke weight and proportions.
2. **Heroicons (outline)** is an acceptable second choice with the same 2 px stroke aesthetic.
3. **Do not** mix Material Icons, Font Awesome solid, or hand-drawn SVG sets — they'll read off-brand.

**Filled vs outline.** Outline 2 px is the default. Filled is reserved for: the sparkle accent mark, the Characters/Styles/DNA glyphs, and the small "active" state of certain product icons.

**Emoji.** Not used. Ever. Including in product UI strings, error states, empty states, and marketing copy.

**Unicode glyphs.** Acceptable for navigation hints: `→` (text-link CTA), `↗` (external link), `⌘` (keyboard shortcut), `▾` (dropdown chevron). Use sparingly.

**Sizes.** 16 px (inline body), 20 px (button + nav default), 24 px (sidebar / standalone), 28+ px (hero illustration accents).

---

## Iteration

Files in this kit are written to be **edited live**. The CSS variables in `colors_and_type.css` are the single source of truth for color and type — every preview card and the UI kit reads from them, so changing a hex there cascades everywhere. The preview/* HTML files are intentionally tiny and self-contained so they render reliably as small cards on the Design System tab.
