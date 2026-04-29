# Spec for Generative Skills Integration

branch: claude/feature/generative-skills

## Summary

Integrate two Anthropic generative creative skills — **Algorithmic Art** (interactive p5.js) and **Canvas Design** (static PNG) — into this project as local skill prompts with slash commands. The skills are sourced from the [anthropics/skills](https://github.com/anthropics/skills) GitHub repo and adapted for use inside Claude Code sessions against this repository.

The primary use case is generating **decorative hero visuals** for site pages — abstract, high-craft PNG images that can be uploaded to the Umbraco media library and assigned as page hero images. Interactive p5.js experiments can also be exported as PNG for the same purpose.

This is a creative experimentation feature. It does not change the running Umbraco site or its build pipeline. All skill assets and generated outputs live outside `src/`.

## Problem Statement

The demo site needs visually distinctive hero images for pages beyond articles (articles already have the flow-field generator). Options like stock photography or prompt-based AI art don't match the site's experimental, code-driven aesthetic. These two Anthropic skills offer a philosophy-first generative approach that produces original, high-craft visuals — and they can run entirely within Claude Code sessions with no external tools.

## Skill 1: Algorithmic Art

**Source**: `skills/algorithmic-art/` in [anthropics/skills](https://github.com/anthropics/skills)

**What it does**: Two-phase creative process:
1. Claude writes an algorithmic philosophy manifesto (`.md`) — a 4-6 paragraph description of a generative art movement
2. Claude reads `templates/viewer.html` and produces a self-contained HTML file with embedded p5.js that expresses the philosophy — complete with seed navigation, parameter sliders, color pickers, and PNG download

**Assets required**:
- `SKILL.md` — full skill prompt (~400 lines of instructions)
- `LICENSE.txt` — Apache 2.0
- `templates/viewer.html` — the HTML template that Claude must read and use as the literal starting point
- `templates/generator_template.js` — reference for p5.js best practices (not used directly in output)

**Output**: An interactive HTML file that opens in any browser. Built-in "Download PNG" exports a 1200x1200 static image suitable for use as a hero visual.

## Skill 2: Canvas Design

**Source**: `skills/canvas-design/` in [anthropics/skills](https://github.com/anthropics/skills)

**What it does**: Two-phase creative process:
1. Claude writes a design philosophy manifesto (`.md`) — a 4-6 paragraph description of a visual aesthetic movement
2. Claude creates a museum/magazine-quality static visual as PNG, using curated fonts from a local `canvas-fonts/` directory. A mandatory second refinement pass is built into the prompt.

**Assets required**:
- `SKILL.md` — full skill prompt (~250 lines of instructions)
- `LICENSE.txt` — Apache 2.0
- `canvas-fonts/` — ~96 files (30 font families as TTF + OFL license files, ~5-10 MB)

**Output**: A single PNG file (or PDF, but PNG preferred for web use). Minimal typography, repeating patterns, systematic visual language.

## Proposed File Structure

```
skills/                              # top-level, outside src/
├── README.md                        # documents how to fetch fonts, run skills
├── algorithmic-art/
│   ├── SKILL.md
│   ├── LICENSE.txt
│   └── templates/
│       ├── viewer.html
│       └── generator_template.js
├── canvas-design/
│   ├── SKILL.md
│   ├── LICENSE.txt
│   └── canvas-fonts/               # gitignored, fetched on demand
│       ├── (*.ttf files)
│       └── (*-OFL.txt license files)
└── output/                          # gitignored — all generated files land here
    ├── algorithmic-art/
    └── canvas-design/
```

**Gitignore rules**:
- `skills/output/` — generated experiments should not be committed
- `skills/canvas-design/canvas-fonts/` — large binary font files fetched on demand via a documented script/command

**Slash commands** (`.claude/commands/`):
- `/algorithmic-art` — invokes the algorithmic art skill, writes output to `skills/output/algorithmic-art/`
- `/canvas-design` — invokes the canvas design skill, writes output to `skills/output/canvas-design/`

## Functional Requirements

### Asset Management
- Algorithmic art assets (SKILL.md, LICENSE.txt, viewer.html, generator_template.js) are committed to the repo since they are small text files
- Canvas design SKILL.md and LICENSE.txt are committed to the repo
- Canvas design fonts are gitignored with a documented fetch command in `skills/README.md`
- The fetch command downloads fonts from the GitHub repo raw URLs into `skills/canvas-design/canvas-fonts/`
- All outputs go to `skills/output/` (gitignored)

### Slash Command: `/algorithmic-art`
- Accepts an optional text argument describing the desired artwork (e.g., "ocean currents and tidal forces")
- If no argument, prompts the user for a description
- Follows the two-phase process from `skills/algorithmic-art/SKILL.md`:
  1. Write the algorithmic philosophy manifesto to `skills/output/algorithmic-art/{slug}-philosophy.md`
  2. Read `skills/algorithmic-art/templates/viewer.html`, then generate the self-contained HTML to `skills/output/algorithmic-art/{slug}.html`
- The command's `allowed-tools` restrict execution to Read and Write (no Bash needed)

### Slash Command: `/canvas-design`
- Accepts an optional text argument describing the desired visual (e.g., "hero image for the sustainability section")
- If no argument, prompts the user for a description
- Checks that `skills/canvas-design/canvas-fonts/` exists and contains font files; if not, instructs the user to run the fetch command first
- Follows the two-phase process from `skills/canvas-design/SKILL.md`:
  1. Write the design philosophy manifesto to `skills/output/canvas-design/{slug}-philosophy.md`
  2. Generate the PNG to `skills/output/canvas-design/{slug}.png`
- The command's `allowed-tools` include Read, Write, and Bash (for canvas rendering via code execution)

### Integration Path (Future)
- Generated PNGs from either skill can be uploaded to the Umbraco media library using the same Management API workflow as the existing image generator (`scripts/image-generator/`)
- The `/cms-image` command or a future `/hero-image` command could wrap the skill output + upload into one step
- No changes to the Umbraco site code, templates, or build pipeline are needed for this phase

## Possible Edge Cases
- `canvas-fonts/` directory is empty or missing when `/canvas-design` is run — the command should detect this and print the fetch instructions rather than failing silently
- User runs `/algorithmic-art` without p5.js CDN access (offline) — the generated HTML will have a broken `<script>` tag; document that an internet connection is needed to view the output
- Output filenames collide (user generates two pieces with the same slug) — append a timestamp or sequence number
- Font fetch script is run repeatedly — should be idempotent (skip already-downloaded files or overwrite cleanly)
- Very large canvas-fonts directory (~10 MB) — gitignore keeps it out of the repo; README documents the fetch step

## Acceptance Criteria
- `skills/` directory exists at the project root with the documented structure
- `skills/algorithmic-art/` contains SKILL.md, LICENSE.txt, and templates/ (viewer.html + generator_template.js)
- `skills/canvas-design/` contains SKILL.md and LICENSE.txt; canvas-fonts/ is gitignored with a fetch command documented in README.md
- `skills/output/` is gitignored
- `/algorithmic-art` slash command exists in `.claude/commands/` and produces an HTML file + philosophy markdown in `skills/output/algorithmic-art/`
- `/canvas-design` slash command exists in `.claude/commands/` and produces a PNG file + philosophy markdown in `skills/output/canvas-design/`
- Running `/algorithmic-art "ocean currents"` produces an interactive HTML that opens in a browser with working seed navigation and parameter controls
- Running `/canvas-design "hero for sustainability page"` produces a PNG file using fonts from canvas-fonts/
- `skills/README.md` documents: what each skill does, how to fetch fonts, the experiment workflow, and how outputs can be used as hero images
- CLAUDE.md is updated with a brief section pointing to the skills directory

## Open Questions
- Should the canvas-design font fetch be a shell script (`scripts/fetch-canvas-fonts.sh`) or inline curl commands in the README? A script is more repeatable; inline commands are simpler for a demo project. --Script
- For the future integration phase, should we create a unified `/hero-image` command that wraps skill invocation + CMS upload, or keep them as separate steps? Separate steps give more control during experimentation.
- Should the algorithmic-art viewer.html template be modified to remove Anthropic branding for outputs intended as site hero images, or keep it as-is for experimentation and crop/export just the canvas area? --remove anthropic branding

## Testing Guidelines

This feature is creative tooling, not site functionality, so formal E2E tests are not needed. Validation is manual:
- Verify the slash commands invoke correctly and produce output files in the expected locations
- Verify the algorithmic-art HTML output opens in a browser with working controls
- Verify the canvas-design PNG output is a valid image file with reasonable dimensions
- Verify the font fetch command downloads fonts to the correct directory
- Verify gitignore rules work (output/ and canvas-fonts/ are not staged by `git add`)
