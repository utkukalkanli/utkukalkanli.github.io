# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Utku Kalkanlı's personal portfolio site — a single-page, hand-written static site published to
**GitHub Pages** at `https://utkukalkanli.github.io` (repo: `utkukalkanli/utkukalkanli.github.io`).

Pushing to `main` deploys. There is no build step, no CI, and no staging environment — whatever
lands on `main` is live within a minute or two. Review changes locally before pushing.

## Running it

No toolchain, no `npm install`. Serve the directory over HTTP (not `file://` — the ES module and
the import map need a real origin):

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Files

| File | Role |
|---|---|
| `index.html` | The entire page. Sections in order: hero, about, skills, experience, demo, education, contact/footer. |
| `style.css` | All styling. Design tokens live in `:root` at the top. |
| `script.js` | Classic script (not a module): 2D particle background, typing animation, nav, scroll fade-ins, language bars. |
| `three-scenes.js` | ES module: all three WebGL scenes. Loaded via an import map pointing at unpkg. |
| `Utku_Kalkanli_{AI_Engineer,Computer_Vision_Engineer,MLOps_Engineer}_CV.pdf` | The three base CVs, offered from the "Download CV" `<details>` menus in the hero and footer. Copied from `cv/` in the private `utkukalkanli/job_search` repo (LaTeX sources live there). Replace in place — the filenames are referenced in `index.html`. |

## Conventions

- **Design tokens**: colours, fonts, radii and the shared transition are CSS custom properties in
  `:root` (`style.css`). Use `var(--cyan)`, `var(--purple)`, `var(--font-mono)` etc. rather than
  hard-coded values. Accent variants follow the pattern `.skill-tag.accent-<name>`.
- **Section numbering**: each `.section-tag` carries a two-digit number (`01`…`05`). Inserting a
  section means renumbering the ones after it.
- **Scroll animation**: adding `class="fade-in"` to an element opts it into the
  IntersectionObserver in `script.js`. Siblings sharing the first class name are staggered.
- **Content is hand-maintained.** The page mirrors the CVs but is not generated from them. When the
  CVs change, the corresponding HTML has to be edited by hand. Every figure and claim on the page must
  match the CVs; don't add facts that aren't on them (the Trendyol and Omdena cards are deliberate
  exceptions).

## The 3D scenes (`three-scenes.js`)

three.js r160 is pulled from unpkg through an `<script type="importmap">` in `index.html`
(`three` and `three/addons/`). To upgrade, bump the version in **both** import-map entries.

Three independent scenes, each guarded so a failure never breaks the page:

1. **Hero point cloud** (`#hero-3d`) — `THREE.Points` over a jittered torus-knot surface with a
   custom shader "line scanner" sweep, mouse parallax and slow rotation.
2. **Skill sphere** (`#skill-sphere`) — `CSS3DRenderer`, so each tag stays a real styled DOM node.
   Tags sit on a Fibonacci sphere; positions are rotated each frame while object rotation stays
   identity, which billboards them for free. Exposed behind a Grid ⇄ Sphere toggle.
3. **Anomaly demo** (`#demo`) — a procedural lathe "part" with Gaussian defects displaced along the
   normals. The undeformed geometry is the CAD reference; per-vertex deviation is the known
   displacement (no ICP needed) and is painted onto a blue→red ramp.

### Rules to preserve when editing

- **Progressive enhancement is the contract.** Everything degrades if the CDN is blocked or WebGL
  is missing: `#particle-canvas` keeps animating (the module only calls
  `window.__stop2DParticles()` after the hero initialises), the demo shows explanatory text with
  its controls left `disabled`, and the skills grid is the default view. Test this by pointing the
  import map at a dead host.
- **Render loops** go through `createLoop()`, which pauses on `visibilitychange` and when the
  element scrolls off screen. Two subtleties that are easy to reintroduce as bugs: `onScreen`
  starts `true` (waiting on the observer's first callback leaves a blank canvas for several
  frames), and the callback must read the **last** entry — coalesced records mean `entries[0]` can
  latch a stale "off screen" and freeze the scene permanently.
- **GLSL `smoothstep` edges must be increasing.** `smoothstep(0.5, 0.0, x)` is undefined behaviour
  and renders nothing on some drivers; write `1.0 - smoothstep(0.0, 0.5, x)`.
- **`hidden` needs a CSS escape hatch.** Any element with a `display` rule in `style.css` also
  needs a `[hidden] { display: none }` rule, or the attribute silently does nothing.
- **Respect `prefers-reduced-motion`**: the hero renders one static frame and the sphere is skipped
  entirely. The sphere is also skipped below 720px.
