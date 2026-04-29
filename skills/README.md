# Generative Skills

Two creative skills from [anthropics/skills](https://github.com/anthropics/skills) for generating decorative hero visuals for site pages.

## Skills

### Algorithmic Art (`/algorithmic-art`)

Interactive p5.js generative art. Uses a two-phase "philosophy then artifact" approach: Claude writes an algorithmic philosophy manifesto, then generates a self-contained HTML file with seed navigation, parameter sliders, and PNG download.

**Output**: `skills/output/algorithmic-art/` — HTML files you can open in a browser and export as PNG.

### Canvas Design (`/canvas-design`)

Static PNG visual design with curated typography. Same philosophy-first approach: Claude writes a design philosophy, then renders a museum/magazine-quality PNG using local font files. A mandatory refinement pass is built into the workflow.

**Output**: `skills/output/canvas-design/` — PNG files ready for use as hero images.

## Setup

### Fetch Canvas Design Fonts

The canvas-design skill requires ~30 font families (~96 files). These are gitignored and must be fetched separately:

```bash
./scripts/fetch-canvas-fonts.sh
```

This downloads fonts from the GitHub repo to `skills/canvas-design/canvas-fonts/`. The script is idempotent — safe to re-run.

### Verify Fonts

```bash
ls skills/canvas-design/canvas-fonts/*.ttf | wc -l
# Should show ~30 font files
```

## Workflow

1. Run `/algorithmic-art "your description"` or `/canvas-design "your description"` in Claude Code
2. Claude writes a philosophy manifesto, then generates the artifact
3. For algorithmic-art: open the HTML in a browser, tweak parameters, use the Download button for PNG
4. For canvas-design: the PNG is generated directly
5. Upload the PNG to the Umbraco media library and assign as a page hero image

## Directory Structure

```
skills/
├── README.md
├── algorithmic-art/
│   ├── SKILL.md              # Full skill instructions
│   ├── LICENSE.txt            # Apache 2.0
│   └── templates/
│       ├── viewer.html        # HTML template (read by Claude during generation)
│       └── generator_template.js  # p5.js reference patterns
├── canvas-design/
│   ├── SKILL.md              # Full skill instructions
│   ├── LICENSE.txt            # Apache 2.0
│   └── canvas-fonts/         # Gitignored — fetched via script
└── output/                   # Gitignored — all generated files
    ├── algorithmic-art/
    └── canvas-design/
```

## Future Integration

The existing image generator (`scripts/image-generator/`) already has a backoffice integration pattern (see `_plans/shipped/palette-storage.md`). A future phase could follow the same architecture to surface these skills to CMS editors: a settings document type, a backoffice dashboard for triggering generation, and a C# service for uploading results to the media library.
