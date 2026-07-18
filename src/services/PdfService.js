/**
 * PdfService
 * ----------
 * Converts a generated .docx into .pdf using headless LibreOffice.
 *
 * Each conversion runs against a throwaway -env:UserInstallation
 * profile so concurrent requests don't fight over LibreOffice's
 * single-instance lock.
 */
const { execFile, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const config = require('../config');

const CONVERT_TIMEOUT_MS = 120000;

class PdfConversionError extends Error {
  constructor(message) { super(message); this.statusCode = 500; }
}

// Resolved once, then cached, so we fail fast with a clear message the
// first time a PDF is requested on a box without LibreOffice installed —
// the most common reason "only Word comes out".
let _binOk = null;
function assertLibreOfficeAvailable() {
  if (_binOk === true) return;
  try {
    execFileSync(config.libreofficeBin, ['--version'], { stdio: 'ignore', timeout: 15000 });
    _binOk = true;
  } catch {
    _binOk = false;
    throw new PdfConversionError(
      `PDF generation requires LibreOffice, but '${config.libreofficeBin}' was not found or not runnable. ` +
      `Install it (Debian/Ubuntu: 'apt-get install -y libreoffice-writer'; macOS: 'brew install --cask libreoffice') ` +
      `and/or set LIBREOFFICE_BIN in your .env to the full path of the 'soffice' binary.`
    );
  }
}

function run(bin, args, timeout) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout, maxBuffer: 1024 * 1024 * 20 }, (err, stdout, stderr) => {
      if (err) return reject(new PdfConversionError(`LibreOffice conversion failed: ${stderr || err.message}`));
      resolve({ stdout, stderr });
    });
  });
}

module.exports = {
  PdfConversionError,

  /**
   * @param {string} docxPath  absolute path to an existing .docx
   * @param {string} outDir    directory the .pdf is written into
   * @returns {Promise<string>} absolute path to the generated .pdf
   */
  async convert(docxPath, outDir) {
    assertLibreOfficeAvailable();
    if (!fs.existsSync(docxPath)) {
      throw new PdfConversionError(`Source DOCX not found: ${docxPath}`);
    }
    fs.mkdirSync(outDir, { recursive: true });

    const profileDir = path.join(os.tmpdir(), `lo-profile-${crypto.randomUUID()}`);
    const args = [
      `-env:UserInstallation=file://${profileDir}`,
      '--headless',
      '--norestore',
      '--convert-to',
      'pdf:writer_pdf_Export',
      '--outdir',
      outDir,
      docxPath,
    ];

    try {
      await run(config.libreofficeBin, args, CONVERT_TIMEOUT_MS);
    } finally {
      fs.rmSync(profileDir, { recursive: true, force: true });
    }

    const pdfPath = path.join(outDir, `${path.basename(docxPath, '.docx')}.pdf`);
    if (!fs.existsSync(pdfPath)) {
      throw new PdfConversionError('LibreOffice reported success but no PDF was produced.');
    }
    return pdfPath;
  },
};
