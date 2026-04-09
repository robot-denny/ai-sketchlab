---
description: Create static PNG visual art using design philosophy and curated typography
allowed-tools: Read, Write, Bash, Glob
argument-hint: "[description of the design you want, e.g. 'hero image for sustainability section']"
---

## User Input

**$ARGUMENTS**

## What This Does

Creates original static visual art as a PNG through a two-phase process: first writing a design philosophy manifesto, then expressing it on a canvas with curated typography and museum-quality composition. Uses local font files for sophisticated typographic design.

## Prerequisites

- Font files must exist in `skills/canvas-design/canvas-fonts/`
- Output directory: `skills/output/canvas-design/`

## Workflow

### 1. Check for fonts

List `skills/canvas-design/canvas-fonts/` for `.ttf` files. If the directory is empty or missing fonts, tell the user:

> Canvas design fonts are not installed. Run:
> ```bash
> ./scripts/fetch-canvas-fonts.sh
> ```
> Then try again.

**Stop here if no fonts are found.** Do not proceed without fonts.

### 2. Determine the description

If `$ARGUMENTS` is empty, ask the user what kind of visual design they'd like. Examples: "hero image for sustainability section", "abstract poster about connectivity", "minimalist cover for quarterly report".

### 3. Derive a slug

Convert the description to kebab-case and append the date for uniqueness:

```
"hero image for sustainability section" → sustainability-hero-2026-04-09
```

### 4. List available fonts

Read the filenames in `skills/canvas-design/canvas-fonts/` so you know what typefaces are available. Use different fonts to create typographic variety — the SKILL.md is emphatic about this.

### 5. Phase 1 — Write the Design Philosophy

Create a design philosophy manifesto and write it to `skills/output/canvas-design/{slug}-philosophy.md`.

This is NOT a layout spec or a design brief. It is a **manifesto for a visual art movement** — an aesthetic worldview that will be expressed through form, space, and color.

**How to write the philosophy:**

1. **Name the movement** (1-2 words): e.g., "Brutalist Joy", "Chromatic Silence", "Metabolist Dreams", "Geometric Silence"

2. **Articulate the philosophy** (4-6 substantial paragraphs) expressing how the vision manifests through:
   - Space and form
   - Color and material
   - Scale and rhythm
   - Composition and balance
   - Visual hierarchy

3. **Critical guidelines:**
   - Avoid redundancy — each design aspect mentioned once, no repeating color theory or spatial relationships unless adding new depth
   - Emphasize craftsmanship REPEATEDLY — stress that the final work should appear meticulously crafted, labored over with care, the product of countless hours by someone at the absolute top of their field. Repeat phrases like "meticulously crafted," "the product of deep expertise," "painstaking attention," "master-level execution"
   - Leave creative space — be specific about the aesthetic direction but concise enough to allow interpretive implementation choices
   - The philosophy must guide visual expression, not text. Information lives in design, not paragraphs
   - Keep the philosophy generic without mentioning the specific intention — as if it could be applied anywhere

4. **Deduce the subtle reference** — Identify a subtle, niche conceptual thread from the user's request. This becomes the soul of the design — quiet conceptual DNA woven invisibly into form, color, and composition. Like a jazz musician quoting another song — only those who know will catch it, but everyone appreciates the art. The reference must be refined so it enhances depth without announcing itself.

### 6. Phase 2 — Create the PNG

With the philosophy and conceptual framework established, create the artwork as a PNG.

**Read `skills/canvas-design/SKILL.md`** before creating the canvas — it contains the full creative framework.

**Output format**: PNG, not PDF. Write to `skills/output/canvas-design/{slug}.png`.

**Canvas creation principles:**

- Use the design philosophy as the foundation for every visual decision
- Create one single-page, highly visual, design-forward composition
- Use repeating patterns and perfect shapes
- Treat the design as if it were a scientific bible — dense accumulation of marks, repeated elements, layered patterns that build meaning through patient repetition
- Add sparse, clinical typography and systematic reference markers
- Anchor with simple phrase(s) or details positioned subtly
- Use a limited color palette that feels intentional and cohesive
- Embrace the paradox of analytical visual language expressing human experience

**Text as a contextual element:**
- Text is always minimal and visual-first
- Let context guide whether that means whisper-quiet labels or bold typographic gestures
- Most of the time, fonts should be thin
- All use of fonts must be design-forward and prioritize visual communication
- Nothing falls off the page, nothing overlaps — every element contained within canvas boundaries with proper margins
- All text, graphics, and visual elements must have breathing room and clear separation
- **Use different fonts from `skills/canvas-design/canvas-fonts/`** — get creative by making typography part of the art itself

**Craftsmanship requirements:**
- The work must look like it took countless hours to create
- Someone at the absolute top of their field labored over every detail with painstaking care
- Composition, spacing, color choices, typography — everything must demonstrate expert-level craftsmanship
- Nothing overlaps, formatting is flawless, every detail perfect
- This is ART, not something cartoony or amateur — even for playful topics, maintain sophistication

### 7. Mandatory Refinement Pass

**This step is NOT optional.** Before finishing, take a second pass.

The user has ALREADY said: "It isn't perfect enough. It must be pristine, a masterpiece of craftsmanship, as if it were about to be displayed in a museum."

**How to refine:**
- Do NOT add more graphics — refine what exists
- Make it extremely crisp, respecting the design philosophy and minimalism
- If the instinct is to draw a new shape or add a filter, STOP — instead ask: "How can I make what's already here more of a piece of art?"
- Focus on making the existing composition more cohesive
- Check alignment, spacing, color harmony, typographic precision
- Re-render the PNG with refinements to the same output path

### 8. Report Results

After generating both files:
1. List the output file paths
2. Confirm the PNG dimensions and format
3. Remind the user the PNG can be uploaded to the Umbraco media library as a hero image (Media section > "Generated Images" folder or create a new one)
