/**
 * DocxService
 * -----------
 * Loads the R-Series .docx template, injects processed values,
 * O-Series overlay sections, the industry table loop, and the two
 * rendered chart images (radar + gauge), then writes the .docx.
 *
 * Template token conventions (see scripts/build_template.py):
 *   {placeholder}          simple text substitution
 *   {#industries}...{/}    table row loop
 *   {#hasOverlays}{#overlays}...{/overlays}{/hasOverlays}   overlay sections
 *   {%radarChart} {%gaugeChart}   image placeholders
 *
 * NOTE: this service performs zero scoring or interpretation. Every
 * value it places on the page was computed upstream.
 */
const fs = require('fs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const ImageModule = require('docxtemplater-image-module-free');

const charts = require('../utils/charts');

// Image sizes in pixels at 96 DPI, matching the reference layout
const IMAGE_SIZES = {
  radarChart: [490, 380],
  gaugeChart: [422, 266],
};

class DocxRenderError extends Error {
  constructor(message, details) {
    super(message);
    this.statusCode = 500;
    this.details = details;
  }
}

function formatDocxtemplaterError(error) {
  if (error.properties && error.properties.errors) {
    return error.properties.errors.map((e) => ({
      id: e.properties?.id,
      explanation: e.properties?.explanation,
      context: e.properties?.context,
    }));
  }
  return [{ explanation: error.message }];
}

module.exports = {
  DocxRenderError,

  /**
   * @param {string} templatePath  absolute path to the R-Series .docx
   * @param {object} data          flat placeholder map from reportDtos
   * @param {object} scores        processed score row (for chart values)
   * @param {string} outputPath    where to write the generated .docx
   */
  async render(templatePath, data, scores, outputPath) {
    const [radarBuf, gaugeBuf] = await Promise.all([
      charts.radarPng(scores.traits || {}),
      charts.gaugePng(Number(scores.fitScores?.jobfitScore) || 0),
    ]);

    const images = { radarChart: radarBuf, gaugeChart: gaugeBuf };

    const imageModule = new ImageModule({
      centered: true,
      getImage: (tagValue) => images[tagValue] || Buffer.alloc(0),
      getSize: (_img, tagValue) => IMAGE_SIZES[tagValue] || [400, 300],
    });

    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);

    let doc;
    try {
      doc = new Docxtemplater(zip, {
        modules: [imageModule],
        paragraphLoop: true,
        linebreaks: true,
        // Unresolved tags render as an empty string rather than throwing,
        // so a template with optional sections stays valid.
        nullGetter: () => '',
      });
      doc.render({ ...data, radarChart: 'radarChart', gaugeChart: 'gaugeChart' });
    } catch (error) {
      throw new DocxRenderError('DOCX template rendering failed.', formatDocxtemplaterError(error));
    }

    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });
    fs.writeFileSync(outputPath, buf);
    return outputPath;
  },
};
