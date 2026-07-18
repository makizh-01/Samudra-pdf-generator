# SAMUDRA.Jobfit — PDF Design Export

The **PDF generation design layer**, extracted from the full backend so it can be
dropped into another project without carrying routes, controllers, database code,
Prisma, auth, middleware, or business logic.

Everything here is a **verbatim copy** of the original files (one small glue file
excepted — see `src/config/index.js`). Nothing in the source backend was modified.

---

## How this report's PDF is produced

Important architectural fact for whoever integrates this:

> **The PDF is rendered from a Word (`.docx`) template, not from HTML.**

The pipeline is:

```
your processed data
      │
      ▼
reportDtos.buildTemplateData()      map data → flat template placeholders
      │
      ▼
DocxService.render()                fill jobfit-master.docx (text + tables + charts)
      │            ▲
      │            └── charts.js     radar + gauge rendered as SVG → PNG, embedded
      ▼
PdfService.convert()                DOCX → PDF via headless LibreOffice
      │
      ▼
   final PDF
```

Because the design lives in a `.docx` template, there are **no HTML / JSX / EJS /
Handlebars templates and no CSS files** in the PDF path — the equivalent "styling"
(fonts, colours, page layout, tables, card boxes) is baked into the template and
into `design-source/build_template.py`. The static brand images (GPS7 logo and the
S.A.M.U.D.R.A framework strip) are **embedded inside the `.docx`**, so they are not
needed as separate files at render time.

---

## What's included, and what each file does

```
pdf-design-export/
├── README.md
├── src/
│   ├── services/
│   │   ├── DocxService.js      Fills the .docx template with data, overlay
│   │   │                       sections, the industry-table loop, and the two
│   │   │                       chart images. Produces the .docx that IS the PDF
│   │   │                       source. (docxtemplater + PizZip + image module)
│   │   └── PdfService.js       Converts the rendered .docx → .pdf using headless
│   │                           LibreOffice. Runs each conversion in a throwaway
│   │                           profile (safe for concurrent calls) and fails fast
│   │                           with a clear message if LibreOffice is missing.
│   ├── models/
│   │   └── reportDtos.js       The data-binding layer: maps your processed data
│   │                           object onto the flat placeholder names the template
│   │                           expects ({candidate_name}, {t_a_score}, industry
│   │                           loop rows, overlay sections, etc.). This is the one
│   │                           place that knows the template's token vocabulary.
│   ├── utils/
│   │   ├── charts.js           Generates the two dynamic visuals as pure SVG and
│   │   │                       rasterizes them to PNG (radar = 7-axis behavioural
│   │   │                       profile with zone bands; gauge = 0–100% Job Fit
│   │   │                       needle). Also holds the framework-strip and GPS7
│   │   │                       logo SVG generators. (needs `sharp`)
│   │   ├── fitBar.js           Builds the text "fit bar" glyphs (▰▱) shown next to
│   │   │                       each industry percentage in the mapping table.
│   │   └── dates.js            Formats the report/assessment dates into the display
│   │                           strings the template shows ("5th May 2026", etc.).
│   └── config/
│       └── index.js            *** The only non-verbatim file. *** A minimal stub
│                               exposing just `libreofficeBin`, because PdfService
│                               does `require('../config')` and reads only that.
│                               Replace with your host app's config if you prefer.
├── templates/
│   └── jobfit-master.docx      The report design itself — a tagged Word template.
│                               8 pages (9 with overlays): cover, candidate + GPS7
│                               + seven-trait framework, radar + S/A/M/U, fit strip
│                               + D/R/A, gauge + summary, industry table, strength/
│                               variability zones, executive summary + disclaimer.
│                               The GPS7 logo and framework strip are baked in.
├── design-source/
│   ├── build_template.py       Python (python-docx) script that GENERATES
│   │                           jobfit-master.docx from scratch. This is the true
│   │                           "source of the design": edit page layout, colours,
│   │                           fonts, tables and placeholder tags here, then
│   │                           regenerate the template. Not needed at PDF render
│   │                           time — only to change the design.
│   └── assets/
│       ├── gps7_logo.png       Cover-page GPS7 mark (embedded by build_template).
│       ├── samudra_framework.png  S.A.M.U.D.R.A hexagon strip (embedded likewise).
│       ├── sample_radar.png    Placeholder chart used only when build_template.py
│       └── sample_gauge.png    runs in "sample" mode; not used by the live renderer.
└── sample/
    └── sample-report.pdf       A PDF produced by exactly the files in this folder.
```

---

## Placeholder / token vocabulary

The template (`jobfit-master.docx`) carries [docxtemplater](https://docxtemplater.com/)
tags. `reportDtos.js` is the single source of truth for what they are:

| Token | Meaning |
|---|---|
| `{candidate_name}`, `{t_a_score}`, `{jobfit_summary_p1}`, … | plain text substitution |
| `{%radarChart}`, `{%gaugeChart}` | image placeholders, filled from `charts.js` |
| `{#industries}…{/industries}` | table-row loop over the industry list |
| `{#hasOverlays}{#overlays}…{/overlays}{/hasOverlays}` | overlay sections, removed entirely when none are enabled |

---

## Dependencies

**npm packages** (for the Node renderer):

| Package | Used by | Purpose |
|---|---|---|
| `docxtemplater` | DocxService | fills tags in the .docx |
| `pizzip` | DocxService | reads/writes the .docx (zip) |
| `docxtemplater-image-module-free` | DocxService | injects the chart PNGs |
| `sharp` | charts.js | rasterizes chart SVG → PNG |

```bash
npm install docxtemplater pizzip docxtemplater-image-module-free sharp
```

**System dependency** (for DOCX → PDF):

- **LibreOffice** (headless `soffice`) must be installed and on `PATH`, or set
  `LIBREOFFICE_BIN` to its full path.
  - Debian/Ubuntu: `apt-get install -y libreoffice-writer fonts-dejavu`
  - macOS: `brew install --cask libreoffice`
    (then `LIBREOFFICE_BIN=/Applications/LibreOffice.app/Contents/MacOS/soffice`)

**To edit the design** (optional, not needed to render):

- Python 3 with `python-docx` — used only by `design-source/build_template.py`.
  ```bash
  pip install python-docx
  python design-source/build_template.py template templates/jobfit-master.docx
  ```

---

## Integrating into another backend

1. Copy `src/services`, `src/models`, `src/utils`, `src/config` and `templates/`
   into your project (keep them together so the relative `require('../…')` paths
   resolve).
2. `npm install docxtemplater pizzip docxtemplater-image-module-free sharp` and
   make sure LibreOffice is available.
3. Call it from your own code — no routes or services from the original project
   are required:

   ```js
   const DocxService = require('./src/services/DocxService');
   const PdfService  = require('./src/services/PdfService');
   const { buildTemplateData } = require('./src/models/reportDtos');
   const path = require('path');

   async function generatePdf(candidate, scores, overlays, outDir) {
     const data = buildTemplateData({ candidate, scores, overlays, reportCode: 'R20' });
     const templatePath = path.join(__dirname, 'templates', 'jobfit-master.docx');
     const docxPath = path.join(outDir, 'report.docx');

     await DocxService.render(templatePath, data, scores, docxPath); // .docx
     const pdfPath = await PdfService.convert(docxPath, outDir);      // .pdf
     return pdfPath;
   }
   ```

   `candidate` and `scores` are plain objects; their expected shape is fully
   described by `reportDtos.buildTemplateData` (traits keyed `S,A,M,U,D,R,AC`,
   a `fitScores` object, an `industries` array, the zone objects, etc.). Feed it
   your own already-processed data.

---

## Deliberately excluded

Per the extraction brief, none of the following were copied: routes, controllers,
API layer, database/Prisma code, repositories, auth, middleware, business logic,
environment files, or lock files.

Two project files that touch the same design but are **not part of the PDF path**
were also left out:

- `HtmlPreviewService.js` — renders a standalone **HTML** preview of the same
  layout. Useful, but it is a separate output format; the PDF does not use it.
- `JsonReportService.js` — serializes the report as JSON; unrelated to rendering.

If you also want the HTML rendition of this design, ask and it can be exported
alongside — it is self-contained (inline CSS + inline SVG) and needs no template.
