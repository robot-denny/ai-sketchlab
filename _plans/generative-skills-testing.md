# Testing Guide: Generative Skills Feature

**Branch**: `claude/feature/generative-skills`
**Tester prerequisites**: Claude Code CLI (or VS Code extension with Claude Code), Node.js, a web browser

---

## 1. Setup

```bash
# Switch to the feature branch
git checkout claude/feature/generative-skills

# Fetch canvas-design fonts (required for /canvas-design only)
./scripts/fetch-canvas-fonts.sh

# Verify fonts downloaded (~30 .ttf files)
ls skills/canvas-design/canvas-fonts/*.ttf | wc -l
```

---

## 2. Test: `/algorithmic-art` slash command

**Run in Claude Code:**
```
/algorithmic-art ocean currents and tidal forces
```

**Expected behavior:**
1. Claude writes a philosophy manifesto markdown file to `skills/output/algorithmic-art/`
2. Claude reads `skills/algorithmic-art/templates/viewer.html`
3. Claude generates a self-contained HTML file to `skills/output/algorithmic-art/`
4. Claude reports the output file paths

**Verify:**
- [ ] Two files created in `skills/output/algorithmic-art/`: a `*-philosophy.md` and a `*.html`
- [ ] Open the HTML file in a browser — it should render interactive p5.js art
- [ ] Sidebar controls work: seed navigation (prev/next), parameter sliders, color pickers
- [ ] "Download PNG" button exports a 1200x1200 PNG image
- [ ] No Anthropic branding visible in the viewer UI (neutral colors, no logo)

---

## 3. Test: `/canvas-design` slash command

**Run in Claude Code:**
```
/canvas-design hero image for the sustainability section
```

**Expected behavior:**
1. Claude checks that `skills/canvas-design/canvas-fonts/` contains font files
2. Claude writes a design philosophy manifesto markdown file
3. Claude generates a PNG image using the local fonts
4. Claude takes a refinement pass (automatic — part of the workflow)
5. Claude reports the output file paths

**Verify:**
- [ ] Two files created in `skills/output/canvas-design/`: a `*-philosophy.md` and a `*.png`
- [ ] Open the PNG — it should be a visually distinctive, typography-driven design
- [ ] The philosophy markdown describes a coherent design aesthetic

---

## 4. Test: `/canvas-design` without fonts

Delete or rename the fonts directory to simulate a first-time setup:

```bash
mv skills/canvas-design/canvas-fonts skills/canvas-design/canvas-fonts-bak
```

**Run in Claude Code:**
```
/canvas-design test without fonts
```

**Expected:** Claude detects missing fonts and prints instructions to run `./scripts/fetch-canvas-fonts.sh` instead of failing silently.

**Restore fonts when done:**
```bash
mv skills/canvas-design/canvas-fonts-bak skills/canvas-design/canvas-fonts
```

---

## 5. Test: Gitignore rules

```bash
# Create dummy files in gitignored locations
touch skills/output/algorithmic-art/test.html
touch skills/output/canvas-design/test.png
touch skills/canvas-design/canvas-fonts/test.ttf

# Verify none appear in git status
git status

# Clean up
rm skills/output/algorithmic-art/test.html
rm skills/output/canvas-design/test.png
rm skills/canvas-design/canvas-fonts/test.ttf
```

**Expected:** None of the three test files appear in `git status` output.

---

## 6. Test: File inventory

Confirm all committed files exist:

```bash
# Skill assets
ls skills/README.md
ls skills/algorithmic-art/SKILL.md
ls skills/algorithmic-art/LICENSE.txt
ls skills/algorithmic-art/templates/viewer.html
ls skills/algorithmic-art/templates/generator_template.js
ls skills/canvas-design/SKILL.md
ls skills/canvas-design/LICENSE.txt

# Slash commands
ls .claude/commands/algorithmic-art.md
ls .claude/commands/canvas-design.md

# Font fetch script (should be executable)
ls -la scripts/fetch-canvas-fonts.sh
```

**Expected:** All files exist. `fetch-canvas-fonts.sh` has execute permission (`-rwxr-xr-x`).

---

## 7. Test: CLAUDE.md documentation

Open `CLAUDE.md` and search for "Generative Skills".

**Expected:** A section between "Image Generator" and "Additional Scripts" that documents:
- The two slash commands (`/algorithmic-art` and `/canvas-design`)
- That assets live in `skills/` and outputs in `skills/output/` (gitignored)
- A pointer to `skills/README.md` for full docs

---

## Notes

- The `/algorithmic-art` HTML output requires an internet connection (p5.js loads from CDN)
- Generated outputs are experiments — quality varies by prompt. Try a few different descriptions
- PNGs from either skill can be uploaded to the Umbraco media library as hero images via the backoffice
- This is creative tooling only — no changes to the Umbraco site, build pipeline, or deployed code
