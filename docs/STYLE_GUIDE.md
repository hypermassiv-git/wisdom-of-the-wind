# Style guide

These values were measured from app.neverland.money's computed styles. They live as tokens in
`app/globals.css` (`@theme` block plus `.panel`, `.btn-primary`, `.btn-ghost`, `.label` and `.skeleton`).
Components only use those tokens, so the whole look can be changed in one place.

## Mood
The app has only a dark theme: deep purple gradients, frosted cards, soft violet glows and rounded shapes.

## Color
| Role | Value |
|---|---|
| Page background | `linear-gradient(116deg, #2E0958, #10002C 50%, #200041)` plus violet radial glows |
| Card | `linear-gradient(180deg, #370F64, #2A0B51)` |
| Text: primary / secondary / muted | `#FFFFFF` / `#D4CEDC` / `#A194B3` |
| Section label | `rgba(178,189,224,.9)` |
| Primary button | `#C757D8 → #9A00B2`; hover `#CF6EDD → #B500D1`; pressed `#9125A1 → #9A00B2` |
| Accent violet | `#9A5CFF` / `#B16EFF` |
| Risk levels: Low / Medium / High | `#34D399` / `#F4B256` / `#FB7185` |
| Rewards | sky-200 `#BAE6FD` |
| Dividers | `rgba(255,255,255,.10)` |

## Type
- **Quicksand** (Google Fonts) for all interface text. Body text is 16/24, card titles are 17–18px at weight 600, and numbers use tabular figures.
- **Cinzel** for the page title only, with 0.06em letter-spacing.
- **Section labels:** 11px, weight 600, uppercase, 0.18em letter-spacing.

## Shape and depth
- **Corner radii:** cards 28px, inner panels 16px, chips 8px, buttons fully round.
- **Card shadow:** `0 26px 56px -42px rgba(3,7,18,.78), 0 0 84px -60px rgba(177,110,255,.12)` plus a 1px inner top highlight.
- **Frosted glass:** `backdrop-filter: blur(26px) saturate(132%)`.

## Motion
- Transitions are 150–200ms.
- Loading skeletons use a shimmer animation, which is turned off when the user prefers reduced motion.

## Kept independent on purpose
We don't use the Neverland name or wordmark, the Nadette mascot, the moon or other illustrations, sparkle icons, the floating sidebar rail, themed names ("Pixie Dust", "Captain's Ledger"), or Cinzel *Decorative*. This keeps the tool from being mistaken for an official Neverland page.
