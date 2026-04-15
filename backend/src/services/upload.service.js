const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { generateId, getUploadDir, sanitizeFilename } = require('../utils/helpers');
const { isAllowedFileType, sanitizeFilePath, checkFileSize } = require('../utils/security');

class UploadService {
  /**
   * Process an uploaded ZIP file containing a web project
   * @param {string} zipPath - Path to uploaded ZIP file
   * @param {string} projectId - Project ID for storage
   * @returns {object} - Extracted project info
   */
  processZipUpload(zipPath, projectId) {
    const uploadDir = getUploadDir(projectId);
    const extractDir = path.join(uploadDir, 'extracted');

    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }

    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    // Check total uncompressed size (max 100MB)
    let totalSize = 0;
    for (const entry of entries) {
      totalSize += entry.header.size;
    }
    checkFileSize(totalSize, 100);

    // Find index.html - could be at root or inside a single subfolder
    let indexEntry = null;
    let baseDir = '';

    for (const entry of entries) {
      const name = entry.entryName;
      if (name === 'index.html' || name.endsWith('/index.html')) {
        const parts = name.split('/');
        if (parts.length === 1) {
          indexEntry = entry;
          baseDir = '';
          break;
        } else if (parts.length === 2) {
          indexEntry = entry;
          baseDir = parts[0] + '/';
          break;
        }
      }
    }

    if (!indexEntry) {
      // Clean up
      try { fs.unlinkSync(zipPath); } catch {}
      throw new Error('index.html not found in the root of the uploaded project. Please ensure your ZIP contains an index.html file at the top level.');
    }

    // Extract allowed files
    const extractedFiles = [];
    for (const entry of entries) {
      if (entry.isDirectory) continue;

      let relativePath = entry.entryName;
      if (baseDir && relativePath.startsWith(baseDir)) {
        relativePath = relativePath.substring(baseDir.length);
      }

      // Skip hidden files and system files
      if (relativePath.startsWith('.') || relativePath.includes('__MACOSX')) continue;

      const safeName = sanitizeFilePath(path.basename(relativePath));
      const safeDir = path.dirname(relativePath).split('/').map(sanitizeFilePath).join('/');
      const outputPath = path.join(extractDir, safeDir, safeName);

      // Check file type
      if (!isAllowedFileType(safeName)) {
        console.warn('Skipping disallowed file type: ' + relativePath);
        continue;
      }

      // Create directory if needed
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Extract file
      fs.writeFileSync(outputPath, entry.getData());

      extractedFiles.push({
        path: relativePath,
        size: entry.header.size,
        type: path.extname(safeName).toLowerCase(),
      });
    }

    // Clean up ZIP
    try { fs.unlinkSync(zipPath); } catch {}

    // Read the index.html content
    const indexPath = path.join(extractDir, 'index.html');
    const htmlContent = fs.readFileSync(indexPath, 'utf-8');

    // Categorize files
    const fileCategories = {
      html: extractedFiles.filter((f) => ['.html', '.htm'].includes(f.type)),
      css: extractedFiles.filter((f) => f.type === '.css'),
      js: extractedFiles.filter((f) => f.type === '.js'),
      images: extractedFiles.filter((f) => ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.bmp'].includes(f.type)),
      fonts: extractedFiles.filter((f) => ['.woff', '.woff2', '.ttf', '.eot', '.otf'].includes(f.type)),
      media: extractedFiles.filter((f) => ['.mp4', '.webm', '.mov', '.mp3', '.wav', '.ogg'].includes(f.type)),
      other: extractedFiles.filter((f) => !['.html', '.htm', '.css', '.js', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.bmp', '.woff', '.woff2', '.ttf', '.eot', '.otf', '.mp4', '.webm', '.mov', '.mp3', '.wav', '.ogg'].includes(f.type)),
    };

    return {
      html: htmlContent,
      files: extractedFiles,
      fileCategories,
      extractDir,
      totalSize,
      fileCount: extractedFiles.length,
    };
  }
}

module.exports = new UploadService();
