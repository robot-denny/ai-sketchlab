# Plan: Generative Skills Integration

**Spec**: `_specs/generative-skills.md`
**Branch**: `claude/feature/generative-skills`

## Context

Two Anthropic generative creative skills — Algorithmic Art (interactive p5.js) and Canvas Design (static PNG) — need to be integrated as local skill prompts with slash commands. Both follow a two-phase "philosophy then artifact" approach. Assets are sourced from [`anthropics/skills`](https://github.com/anthropics/skills) on GitHub. The primary goal is generating decorative hero visuals for site pages as PNG images.

The project already has a flow-field image generator at `scripts/image-generator/` with a `/cms-image` slash command at `.claude/commands/cms-image.md`. This new work is complementary — the existing generator is deterministic/metadata-driven, while these skills are creative/philosophy-driven.

Looking ahead, the image generator's backoffice integration (see `_plans/palette-storage.md`) provides a template for how these skills could eventually be surfaced to CMS editors: a settings document type for configuration (e.g., style presets, target pages), a backoffice dashboard or entity action for triggering generation, and a C# service that invokes the CLI and uploads the result to the media library. This phase focuses on the CLI/slash-command foundation; a future phase would add the backoffice layer following that same pattern.

---

## Key Decisions

- **Top-level `skills/` directory**: Keeps creative skill assets cleanly separated from `src/`, `scripts/`, and `tests/`. Not served by Umbraco (outside `wwwroot/`). Mirrors the project's convention of top-level support directories (`_specs/`, `_plans/`, `scripts/`).
- **Fonts gitignored, fetched via script**: The ~96 font files (~5-10 MB of TTF binaries) shouldn't bloat the repo. A shell script at `scripts/fetch-canvas-fonts.sh` fetches them from GitHub (idempotent — safe to re-run). All other skill assets (SKILL.md, LICENSE.txt, templates) are committed as small text files.
- **Output directory gitignored**: All generated files (HTML, PNG, MD philosophies) go to `skills/output/` which is gitignored. This prevents accidental commits of experiment artifacts.
- **Slash commands, not plugin installation**: The skills are wired as `.claude/commands/` slash commands that embed the SKILL.md instructions directly (adapted for this project's paths and output conventions). This avoids needing the Claude Code CLI plugin system and keeps everything self-contained.
- **PNG as primary canvas-design output**: The SKILL.md supports both PDF and PNG; the slash command instructs Claude to produce PNG for web use as hero images.
- **Remove Anthropic branding from viewer template**: The downloaded `viewer.html` will be modified to strip the Anthropic-specific branding (colors, fonts, logo references) so outputs are neutral and ready for use as site hero images. The interactive sidebar structure (seed navigation, parameter sliders, download button) is kept — only the brand identity is removed. This is done in Step 2 after downloading the original.
- **Future CMS integration pattern**: Following the same architecture as the image generator's backoffice integration (`_plans/palette-storage.md`), a future phase could add: (1) a "Generative Skills Settings" document type for storing style presets and configuration, (2) a backoffice dashboard or entity action for editors to trigger generation, (3) a C# service that invokes the skills CLI and uploads results to the media library. This phase builds only the CLI/slash-command foundation.

---

## Steps

Each step is designed to be completed independently in its own context window.
The step heading contains a ready-to-use prompt you can paste into a new chat.

---

### Step 1 — Fetch assets and create directory structure

> **Prompt**: Implement Step 1 of `_plans/generative-skills.md`. Create the `skills/` directory structure, download the Algorithmic Art and Canvas Design skill assets from the anthropics/skills GitHub repo using raw URLs, update `.gitignore` to exclude `skills/output/` and `skills/canvas-design/canvas-fonts/`, create `scripts/fetch-canvas-fonts.sh` (a shell script that fetches fonts from GitHub), and create `skills/README.md` documenting the setup. Do NOT download fonts yet — just create the fetch script. Verify the structure with `ls -R skills/` and confirm gitignore works with `git status`.

**What to build**:

1. Create directory structure:
   ```
   skills/
   ├── algorithmic-art/
   │   └── templates/
   ├── canvas-design/
   │   └── canvas-fonts/        (empty, gitignored)
   └── output/
       ├── algorithmic-art/
       └── canvas-design/
   ```

2. Download files via `curl -sL` from `https://raw.githubusercontent.com/anthropics/skills/main/skills/...`:
   - `skills/algorithmic-art/SKILL.md`
   - `skills/algorithmic-art/LICENSE.txt`
   - `skills/algorithmic-art/templates/viewer.html`
   - `skills/algorithmic-art/templates/generator_template.js`
   - `skills/canvas-design/SKILL.md`
   - `skills/canvas-design/LICENSE.txt`

3. Add to `.gitignore`:
   ```
   # Generative skills outputs and large assets
   skills/output/
   skills/canvas-design/canvas-fonts/
   ```

4. Create `scripts/fetch-canvas-fonts.sh`:
   - Uses the GitHub API (`https://api.github.com/repos/anthropics/skills/contents/skills/canvas-design/canvas-fonts`) to list all files
   - Downloads each `.ttf` and `*-OFL.txt` file via raw GitHub URLs to `skills/canvas-design/canvas-fonts/`
   - Idempotent — skips files that already exist (or overwrites cleanly)
   - Make executable (`chmod +x`)
   - Un-gitignore this specific script path (it lives under `scripts/` which is already gitignored; add `!scripts/fetch-canvas-fonts.sh`)

5. Create `skills/README.md` documenting:
   - What each skill does (1-2 sentences each)
   - How to fetch canvas-design fonts: `./scripts/fetch-canvas-fonts.sh`
   - The experiment workflow for each skill
   - How to use generated PNGs as hero images (upload to Umbraco media library)
   - Future integration notes: points to `_plans/palette-storage.md` as the pattern for eventual backoffice integration

6. Add a `.gitkeep` to `skills/output/algorithmic-art/` and `skills/output/canvas-design/` so the empty directories are tracked, then immediately gitignore the contents.

**Validation**:
- [Automated]: `ls -R skills/` shows the expected structure with all 6 downloaded files
- [Automated]: `git status` shows the new files staged but NOT `skills/output/` or `skills/canvas-design/canvas-fonts/`
- [Manual]: Open `skills/algorithmic-art/templates/viewer.html` in a browser — should render the Anthropic-branded viewer (with placeholder/empty canvas since no algorithm is loaded)

---

### Step 2 — Create the `/algorithmic-art` slash command

> **Prompt**: Implement Step 2 of `_plans/generative-skills.md`. Two tasks: (A) Modify the downloaded `skills/algorithmic-art/templates/viewer.html` to remove Anthropic-specific branding — replace Anthropic color variables, Poppins/Lora Google Fonts, and any logo/brand references with neutral alternatives, while keeping the full interactive sidebar structure (seed navigation, parameter sliders, action buttons, download PNG). (B) Create `.claude/commands/algorithmic-art.md` — a slash command that invokes the Algorithmic Art skill. The command should accept an optional description argument, follow the two-phase philosophy-then-code workflow from `skills/algorithmic-art/SKILL.md`, and write outputs to `skills/output/algorithmic-art/`. Study the existing `/cms-image` command at `.claude/commands/cms-image.md` for the frontmatter format. Read `skills/algorithmic-art/SKILL.md` in full to understand the complete workflow before writing the command.

**What to build**:

**A. Debrand `viewer.html`**:
- Replace Anthropic CSS custom properties (`--anthropic-dark`, `--anthropic-light`, `--anthropic-orange`, `--anthropic-blue`, `--anthropic-green`) with neutral names and colors (e.g., `--ui-dark`, `--ui-light`, `--accent-warm`, `--accent-cool`, `--accent-green`)
- Replace Poppins/Lora Google Fonts imports with system font stack or other neutral web-safe fonts
- Remove any Anthropic logo, company name, or attribution text from the HTML
- Keep all interactive functionality intact: seed navigation, parameter sliders, color pickers, regenerate/reset/download buttons
- The template should feel clean and generic — suitable for producing hero images for any site

**B. Create `.claude/commands/algorithmic-art.md`** with:

- **Frontmatter**: description, allowed-tools (`Read`, `Write`, `Glob`), argument-hint
- **User Input section**: captures `$ARGUMENTS`
- **What This Does section**: brief explanation
- **Prerequisites section**: notes that `skills/algorithmic-art/templates/viewer.html` must exist
- **Workflow section** that instructs Claude to:
  1. Derive a slug from the user's description (kebab-case, timestamp suffix for uniqueness)
  2. Write the algorithmic philosophy manifesto to `skills/output/algorithmic-art/{slug}-philosophy.md`
  3. Read `skills/algorithmic-art/templates/viewer.html` (mandatory — the SKILL.md is emphatic about this)
  4. Read `skills/algorithmic-art/templates/generator_template.js` for reference
  5. Generate the self-contained HTML to `skills/output/algorithmic-art/{slug}.html` using the template as the literal starting point, replacing only the variable sections (algorithm, parameters, UI controls)
  6. Report the output file paths and remind the user they can open the HTML in a browser and use the Download button to export a PNG for hero image use

The command should embed the key creative instructions from the SKILL.md (the philosophy creation guidelines, the template usage rules, the craftsmanship requirements) rather than just saying "follow the SKILL.md" — because the slash command IS the prompt that Claude will execute. The command should also note that the template has been debranded and uses neutral styling.

**Validation**:
- [Automated]: File exists at `.claude/commands/algorithmic-art.md` with valid frontmatter
- [Manual]: Run `/algorithmic-art "ocean currents and tidal forces"` in Claude Code — should produce two files in `skills/output/algorithmic-art/` and the HTML should open in a browser with working p5.js art

---

### Step 3 — Create the `/canvas-design` slash command

> **Prompt**: Implement Step 3 of `_plans/generative-skills.md`. Create `.claude/commands/canvas-design.md` — a slash command that invokes the Canvas Design skill. The command should accept an optional description argument, follow the two-phase philosophy-then-canvas workflow from `skills/canvas-design/SKILL.md`, and write PNG output to `skills/output/canvas-design/`. Study the existing `/cms-image` command at `.claude/commands/cms-image.md` for the frontmatter format. Read `skills/canvas-design/SKILL.md` in full to understand the complete workflow before writing the command.

**What to build**:

Create `.claude/commands/canvas-design.md` with:

- **Frontmatter**: description, allowed-tools (`Read`, `Write`, `Bash`, `Glob`), argument-hint
- **User Input section**: captures `$ARGUMENTS`
- **What This Does section**: brief explanation
- **Prerequisites section**: notes that `skills/canvas-design/canvas-fonts/` must contain font files; includes the fetch command if they're missing
- **Workflow section** that instructs Claude to:
  1. Check that `skills/canvas-design/canvas-fonts/` contains `.ttf` files; if empty, print the fetch instructions from `skills/README.md` and stop
  2. Derive a slug from the user's description
  3. Write the design philosophy manifesto to `skills/output/canvas-design/{slug}-philosophy.md`
  4. List available fonts in `skills/canvas-design/canvas-fonts/` so Claude knows what's available
  5. Generate the PNG to `skills/output/canvas-design/{slug}.png` — the command must specify PNG format (not PDF)
  6. Take the mandatory refinement pass (built into the SKILL.md workflow)
  7. Report the output file paths and remind the user the PNG can be uploaded as a hero image

The command should embed the key creative instructions from the SKILL.md (the philosophy creation guidelines, the canvas creation rules, the refinement pass, the font usage instructions) rather than just referencing the SKILL.md.

**Validation**:
- [Automated]: File exists at `.claude/commands/canvas-design.md` with valid frontmatter
- [Manual]: Run `/canvas-design "hero image for sustainability section"` in Claude Code — should produce a philosophy markdown and a PNG in `skills/output/canvas-design/`

---

### Step 4 — Update CLAUDE.md and verify end-to-end

> **Prompt**: Implement Step 4 of `_plans/generative-skills.md`. Add a "Generative Skills" section to `CLAUDE.md` (after the "Image Generator" section) that briefly documents the `skills/` directory, the two slash commands (`/algorithmic-art` and `/canvas-design`), and how generated PNGs can be used as hero images. Keep it concise — 10-15 lines max. Then do a final verification: confirm all files exist, gitignore rules work, and the directory structure matches the spec.

**What to build**:

1. Add to `CLAUDE.md` after the "## Image Generator" section:
   ```markdown
   ## Generative Skills

   Two creative skills from [anthropics/skills](https://github.com/anthropics/skills) for generating decorative hero visuals:

   - `/algorithmic-art` — Interactive p5.js generative art. Outputs self-contained HTML with seed navigation and parameter controls. Export PNG via the built-in download button.
   - `/canvas-design` — Static PNG visual design with curated typography. Requires fonts (see `skills/README.md` for fetch instructions).

   Assets live in `skills/`. Outputs go to `skills/output/` (gitignored). See `skills/README.md` for full documentation.
   ```

2. Verify the complete file inventory:
   - `skills/algorithmic-art/SKILL.md` ✓
   - `skills/algorithmic-art/LICENSE.txt` ✓
   - `skills/algorithmic-art/templates/viewer.html` ✓
   - `skills/algorithmic-art/templates/generator_template.js` ✓
   - `skills/canvas-design/SKILL.md` ✓
   - `skills/canvas-design/LICENSE.txt` ✓
   - `skills/canvas-design/canvas-fonts/` (empty, gitignored) ✓
   - `skills/output/` (gitignored) ✓
   - `skills/README.md` ✓
   - `.claude/commands/algorithmic-art.md` ✓
   - `.claude/commands/canvas-design.md` ✓

**Validation**:
- [Automated]: `git status` shows only the intended tracked files (no output/ or canvas-fonts/ content)
- [Automated]: `grep -c "Generative Skills" CLAUDE.md` returns 1
- [Manual]: Read through `CLAUDE.md` to confirm the new section fits naturally

---

## File Summary

| Action | File |
|--------|------|
| Create | `skills/README.md` |
| Create | `skills/algorithmic-art/SKILL.md` (downloaded from GitHub) |
| Create | `skills/algorithmic-art/LICENSE.txt` (downloaded from GitHub) |
| Create + Modify | `skills/algorithmic-art/templates/viewer.html` (downloaded, then debranded) |
| Create | `skills/algorithmic-art/templates/generator_template.js` (downloaded from GitHub) |
| Create | `skills/canvas-design/SKILL.md` (downloaded from GitHub) |
| Create | `skills/canvas-design/LICENSE.txt` (downloaded from GitHub) |
| Create | `scripts/fetch-canvas-fonts.sh` |
| Create | `.claude/commands/algorithmic-art.md` |
| Create | `.claude/commands/canvas-design.md` |
| Modify | `.gitignore` |
| Modify | `CLAUDE.md` |
