---
name: warm-editorial-design
description: Use this skill to generate well-branded interfaces and assets in a warm editorial style — cream canvas + coral CTAs + dark-slate product surfaces, with serif display and humanist sans body. Suitable for production or throwaway prototypes/mocks. Contains design guidelines, colors, type, fonts, assets, and a UI kit for prototyping.
---

Read the README.md file within this skill, and explore the other available files. Key entry points:

- `README.md` — content fundamentals, visual foundations, iconography
- `colors_and_type.css` — CSS variables for the full token system; import this first
- `assets/icons/` — SVGs ready to drop into HTML
- `ui_kits/chat-product/` — high-fidelity chat product surface (composer, sidebar, character cards, login). Read `ui_kits/chat-product/index.html` for a working example.
- `preview/*.html` — small standalone specimens for each token / component, useful as references when building new screens

If creating visual artifacts (slides, mocks, throwaway prototypes, marketing pages, decks): copy assets out of `assets/` and create static HTML files. Always `<link rel="stylesheet" href="…/colors_and_type.css">` so token names work.

If working on production code: copy assets and lift the rules in README.md (content fundamentals, visual foundations) into your codebase. The CSS variable names are designed to map cleanly to a design-token export.

If invoked without other guidance, ask the user what they want to build, ask a few clarifying questions (audience, surface — is this marketing-cream or product-dark?, what to put on it), then act as an expert designer who outputs HTML artifacts or production code depending on the need.

**Hard rules**
- Cream canvas (`#FAF9F5`) for marketing, dark slate (`#262625`) for product. Never pure white.
- Display headlines: Fraunces serif, weight 400, negative letter-spacing. **Never bold display.**
- Body / UI: Inter, weights 400 / 500. Humanist sans only.
- Coral `#CC785C` is for primary CTAs and full-bleed coral bands only — not decorative accents.
- No emoji. Sentence case. Periods on headlines.
- Flat-first; shadows rare; no glassmorphism; no gradients on bands.
- Outline icons at 2 px stroke (Lucide-style). Filled glyphs are reserved for the sparkle accent and a small set of feature icons.
