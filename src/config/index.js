/**
 * Minimal config for the PDF design layer.
 * -----------------------------------------
 * PdfService.js does `require('../config')` and reads exactly ONE value
 * from it: `libreofficeBin`. This stub provides only that, so the copied
 * PdfService runs unmodified without dragging in the original project's
 * dotenv setup, database paths, or report enums.
 *
 * To integrate into an existing backend you have two options:
 *   1. Keep this file — set LIBREOFFICE_BIN in the host process env if
 *      `soffice` isn't on PATH.
 *   2. Delete this file and point PdfService's `require('../config')` at
 *      your host app's own config object, as long as it exposes
 *      `libreofficeBin`.
 */
module.exports = {
  // Name or absolute path of the LibreOffice binary used for DOCX -> PDF.
  //   Debian/Ubuntu : soffice           (apt-get install libreoffice-writer)
  //   macOS         : /Applications/LibreOffice.app/Contents/MacOS/soffice
  libreofficeBin: process.env.LIBREOFFICE_BIN || 'soffice',
};
