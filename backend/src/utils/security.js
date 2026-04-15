const { URL } = require('url');
const dns = require('dns');
const { promisify } = require('util');

const dnsLookup = promisify(dns.lookup);

// Private IP ranges to block (SSRF protection)
const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
  /^fd/,
];

const BLOCKED_HOSTNAMES = [
  'localhost',
  'metadata.google.internal',
  'metadata',
  '169.254.169.254',
];

/**
 * Validate a URL for cloning - blocks private IPs and dangerous protocols
 */
async function validateCloneUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error('Invalid URL format');
  }

  // Only allow http/https
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS protocols are allowed');
  }

  // Block known dangerous hostnames
  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    throw new Error('Access to internal addresses is not allowed');
  }

  // Resolve DNS and check for private IPs
  try {
    const { address } = await dnsLookup(hostname);
    for (const range of PRIVATE_RANGES) {
      if (range.test(address)) {
        throw new Error('Access to private/internal IP addresses is not allowed');
      }
    }
  } catch (err) {
    if (err.message.includes('not allowed')) throw err;
    throw new Error(`Cannot resolve hostname: ${hostname}`);
  }

  return parsed;
}

/**
 * Sanitize HTML using DOMPurify (server-side via jsdom)
 */
function sanitizeHtml(html) {
  const { JSDOM } = require('jsdom');
  const createDOMPurify = require('dompurify');
  const window = new JSDOM('').window;
  const DOMPurify = createDOMPurify(window);

  return DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    ADD_TAGS: ['style', 'link', 'meta', 'title', 'head', 'body', 'html', 'iframe', 'video', 'audio', 'source', 'picture', 'figure', 'figcaption', 'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'g', 'defs', 'use', 'symbol', 'clipPath', 'mask'],
    ADD_ATTR: ['style', 'class', 'id', 'href', 'src', 'alt', 'title', 'data-*', 'role', 'aria-*', 'target', 'rel', 'type', 'media', 'sizes', 'crossorigin', 'integrity', 'loading', 'decoding', 'fetchpriority', 'width', 'height', 'viewBox', 'fill', 'stroke', 'xmlns', 'd', 'transform', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'preserveAspectRatio', 'autoplay', 'controls', 'loop', 'muted', 'poster', 'preload', 'playsinline'],
    FORBID_TAGS: ['script', 'noscript'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onsubmit', 'onchange', 'oninput'],
  });
}

/**
 * Sanitize a filename to prevent path traversal
 */
function sanitizeFilePath(filename) {
  return require('path').basename(filename).replace(/[^a-zA-Z0-9_.\-]/g, '_');
}

/**
 * Check file size limit
 */
function checkFileSize(sizeBytes, maxMB) {
  if (sizeBytes > maxMB * 1024 * 1024) {
    throw new Error(`File exceeds maximum size of ${maxMB}MB`);
  }
}

/**
 * Allowed file extensions for upload
 */
const ALLOWED_EXTENSIONS = new Set([
  '.html', '.htm', '.css', '.js',
  '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.bmp',
  '.mp4', '.webm', '.mov',
  '.mp3', '.wav', '.ogg',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.pdf', '.json', '.xml', '.txt', '.csv',
  '.map', // source maps
]);

function isAllowedFileType(filename) {
  const ext = require('path').extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

module.exports = {
  validateCloneUrl,
  sanitizeHtml,
  sanitizeFilePath,
  checkFileSize,
  isAllowedFileType,
  ALLOWED_EXTENSIONS,
};
