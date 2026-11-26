---
inclusion: always
---
# Art direction: "The Haunted Study"

We compete in the **Costume Contest** track. The UI is the product, so it has to look haunting, polished and unforgettable, and every spooky element has to carry information. This file overrides the palette and fonts in design.md where they conflict.

## Concept
A cursed study hall at midnight. Your desk and grimoire is the fortress at the left. Coursework crawls out of the fog on the right as ghostly creatures, each carrying its assignment name on a torn, floating scroll. Each lane is a course, lit by its own candle. A deadline is a tombstone carved with the due date, and it cracks as the date gets close.

## Palette (CSS tokens in `src/styles/tokens.css`, mirrored as numbers in `src/game/palette.ts`)
- Void `#07060b`, Ink `#120f1a`, Stone `#1d1828`, Mist `#2b2440`
- Parchment `#e9dcc0` (main text on dark), Faded ink `#a89f8c` (secondary)
- Candle gold `#f2b45a` (primary accent, focus, gold currency)
- Spectral teal `#6ee7d0` (correct answer, charge, the player's magic)
- Wax crimson `#b3202c` (danger, damage, deadlines)
- Course colours are muted jewel tones, not neon: CV `#5b8def`, PHO `#a274f0`, MGT `#e0874a`, DSA `#d9b54a`, MKT `#d85a8e`, MATH `#4fc29a`
- Text needs at least 4.5:1 contrast on its background.

## Typography (Google Fonts, all OFL)
- Display: **Cinzel Decorative** (logo), **Cinzel** (headings, wave titles)
- Body/UI: **Spectral** (story text, questions), **Inter** (numbers, HUD, buttons; use `font-variant-numeric: tabular-nums`)
- No Creepster or "dripping blood" novelty fonts. The fear comes from atmosphere, not clip-art.

## Light & atmosphere (procedural, no raster assets)
- Layered parallax fog with slow noise drift, a vignette, a flickering candle glow per lane, and drifting dust motes.
- Phaser 4 post-FX (glow/bloom, vignette, subtle chromatic shake on big hits). Everything degrades gracefully with reduced motion: no shake, no flicker, fog drift slowed to almost static.
- Enemies are silhouettes with an inner glow in the course colour, wispy trailing particles, and a floating scroll label showing the coursework name and "due in N days".
- Bosses (exams) are big, have a slow heartbeat pulse and announce themselves with a full-width title card ("MIDTERM EXAMINATION — rises in 4 days").

## UI chrome (DOM + GSAP overlays)
- Panels look like grimoire pages: dark parchment gradients, ink borders, small wax-seal badges for course codes, ornamental corner flourishes drawn as inline SVG.
- Transitions: ink-bleed wipes between scenes, candle-snuff fades. Keep them 250–600ms with eased timing.
- Buttons have tactile states: hover glow, pressed sink, and a focus ring in candle gold.
- Quick-time exam events: the screen desaturates, time slows, a heartbeat sound plays, and the question card slams in with a burning countdown ring.
- Feedback is generous ("juice"): damage numbers in Inter, hit sparks, a screen pulse on a critical hit, gold coins arcing to the HUD.

## Sound (synthesised with WebAudio, no copyrighted music)
Low drone pad, distant bell on each new wave, quill scratches when answering, heartbeat during quick-time events. Every sound has a visual caption cue. A mute toggle is always visible.

## Quality bar
- No placeholder rectangles in any commit that reaches `main` after the theme phase.
- Every screen must look good as a still frame, because it will appear in the demo video.
- Holds 60fps on a laptop with 60+ enemies on screen.
