---
description: Create algorithmic generative art as self-contained interactive HTML using p5.js
allowed-tools: Read, Write, Glob
argument-hint: "[description of the art you want, e.g. 'ocean currents and tidal forces']"
---

## User Input

**$ARGUMENTS**

## What This Does

Creates original algorithmic generative art through a two-phase process: first writing an algorithmic philosophy manifesto, then expressing it as a self-contained interactive HTML file with p5.js. The output includes seed navigation, parameter sliders, and a download button for exporting PNGs suitable for hero images.

## Prerequisites

- Template must exist at `skills/algorithmic-art/templates/viewer.html`
- Output directory: `skills/output/algorithmic-art/`

## Workflow

### 1. Determine the description

If `$ARGUMENTS` is empty, ask the user what kind of generative art they'd like. Examples: "ocean currents and tidal forces", "crystal growth under pressure", "neural pathways firing".

### 2. Derive a slug

Convert the description to kebab-case and append a short timestamp for uniqueness:

```
"ocean currents and tidal forces" → ocean-currents-2026-04-09
```

### 3. Phase 1 — Write the Algorithmic Philosophy

Create an algorithmic philosophy manifesto and write it to `skills/output/algorithmic-art/{slug}-philosophy.md`.

This is NOT a description of an image. It is a **manifesto for a generative art movement** — a computational worldview that will be expressed through code.

**How to write the philosophy:**

1. **Name the movement** (1-2 words): e.g., "Organic Turbulence", "Quantum Harmonics", "Emergent Stillness"

2. **Articulate the philosophy** (4-6 substantial paragraphs) expressing how the vision manifests through:
   - Computational processes and mathematical relationships
   - Noise functions and randomness patterns
   - Particle behaviors and field dynamics
   - Temporal evolution and system states
   - Parametric variation and emergent complexity

3. **Critical guidelines for the philosophy:**
   - Avoid redundancy — each algorithmic aspect mentioned once, no repeating noise theory or particle dynamics unless adding new depth
   - Emphasize craftsmanship REPEATEDLY — stress that the final algorithm should appear meticulously crafted, refined with care, the product of deep computational expertise, painstaking optimization, master-level implementation
   - Leave creative space — be specific about the algorithmic direction but concise enough to allow interpretive implementation choices
   - Beauty lives in the process, not the final frame

4. **Deduce the conceptual seed** — Identify a subtle, niche reference from the user's request that becomes the soul of the algorithm. This is NOT literal — it's a quiet conceptual DNA woven into parameters, behaviors, and emergence patterns. Like a jazz musician quoting another song through algorithmic harmony — only those who know will catch it, but everyone appreciates the generative beauty.

### 4. Phase 2 — Create the Interactive HTML

**Before writing any HTML, you MUST:**

1. Read `skills/algorithmic-art/templates/viewer.html` — this is the LITERAL STARTING POINT, not inspiration
2. Read `skills/algorithmic-art/templates/generator_template.js` for p5.js best practices

**The template has been debranded** — it uses neutral system fonts and generic CSS variables (`--ui-dark`, `--ui-light`, `--accent-warm`, `--accent-cool`, `--accent-green`). Keep this neutral styling.

**What is FIXED (keep exactly as-is from the template):**
- Layout structure (sidebar + main canvas area)
- UI styling (colors, fonts, gradients)
- Seed section in sidebar (seed display, prev/next/random/jump buttons)
- Actions section in sidebar (reset button)
- Self-contained single-file structure (no external files except p5.js CDN)

**What is VARIABLE (customize for each artwork):**
- The title and subtitle in the sidebar header
- The entire p5.js algorithm (setup/draw/classes)
- The parameters object
- The Parameters section controls (number, names, min/max/step for sliders)
- The Colors section (optional — include color pickers if art needs adjustable colors, skip if fixed/monochrome)

**Add a Download PNG button** in the Actions section:
```html
<button class="button tertiary" onclick="saveCanvas('generative-art-' + params.seed, 'png')">↓ Download PNG</button>
```

**Technical requirements:**
- **Seeded randomness**: Always use `randomSeed(seed)` and `noiseSeed(seed)` — same seed MUST produce identical output
- **Canvas size**: 1200x1200
- **p5.js from CDN**: `https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.7.0/p5.min.js`
- **Performance**: Smooth execution, optimized for real-time if animated

**Craftsmanship requirements:**
- The algorithm must feel like it emerged through countless iterations by a master generative artist
- Balance: complexity without visual noise, order without rigidity
- Color harmony: thoughtful palettes, not random RGB values
- Composition: even in randomness, maintain visual hierarchy and flow
- The algorithm flows from the philosophy, NOT from a menu of patterns — if the philosophy is about organic emergence, build growth and feedback loops; if about mathematical beauty, build geometric relationships and harmonics

**Implementation approach:**
- Let the philosophy dictate what to build — don't think "which pattern should I use?" but "how do I express this philosophy through code?"
- Design parameters that emerge naturally from the philosophy — "what qualities of this system can be adjusted?"
- This is LIVING ALGORITHMS, not static images with randomness
- Do NOT copy the flow field example from the template — build what YOUR philosophy demands

Write the HTML to `skills/output/algorithmic-art/{slug}.html`.

### 5. Report Results

After generating both files:
1. List the output file paths
2. Remind the user they can open the HTML in any browser — it's completely self-contained
3. Mention the seed navigation (prev/next/random) for exploring variations
4. Mention the Download PNG button for exporting a specific seed as a hero image
