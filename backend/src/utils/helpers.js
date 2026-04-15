const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

function generateId() {
  return uuidv4();
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

function getUploadDir(projectId) {
  const dir = path.join(__dirname, '..', '..', 'uploads', projectId);
  return ensureDir(dir);
}

function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 255);
}

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function extractDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

function getFileExtension(url) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const ext = path.extname(pathname);
    return ext || '';
  } catch {
    return '';
  }
}

module.exports = {
  generateId,
  ensureDir,
  getUploadDir,
  sanitizeFilename,
  isValidUrl,
  extractDomain,
  getFileExtension,
};
