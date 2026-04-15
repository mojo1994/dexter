const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const archiver = require('archiver');
const { generateId, getUploadDir, sanitizeFilename, isValidUrl, getFileExtension } = require('../utils/helpers');
const { validateCloneUrl } = require('../utils/security');

puppeteer.use(StealthPlugin());

class ClonerService {
  constructor() {
    this.browser = null;
  }

  async getBrowser() {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
        ],
        timeout: parseInt(process.env.PUPPETEER_TIMEOUT, 10) || 60000,
      });
    }
    return this.browser;
  }

  async clonePage(url, projectId, onProgress, retries) {
    if (!onProgress) onProgress = function() {};
    if (retries === undefined) retries = 2;
    await validateCloneUrl(url);

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this._doClone(url, projectId, onProgress);
      } catch (err) {
        if (attempt === retries) throw err;
        const delay = Math.pow(2, attempt) * 1000;
        onProgress('retrying', 0, 'Attempt ' + (attempt + 1) + ' failed, retrying...');
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  async _doClone(url, projectId, onProgress) {
    onProgress('fetching', 10, 'Launching browser...');
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      onProgress('fetching', 20, 'Loading page...');

      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: parseInt(process.env.PUPPETEER_TIMEOUT, 10) || 60000,
      });

      // Wait extra for SPAs
      await new Promise((resolve) => setTimeout(resolve, 2000));
      onProgress('fetching', 35, 'Page loaded, extracting content...');

      const fullHtml = await page.content();
      const uploadDir = getUploadDir(projectId);
      const thumbnailPath = path.join(uploadDir, 'thumbnail.png');
      await page.screenshot({ path: thumbnailPath, type: 'png', fullPage: false });

      onProgress('parsing', 40, 'Parsing HTML and extracting assets...');

      const $ = cheerio.load(fullHtml);
      const assets = [];

      // Process images
      $('img').each((_, el) => {
        const src = $(el).attr('src');
        if (src && isValidUrl(this.resolveUrl(src, url))) {
          const assetId = generateId();
          const ext = getFileExtension(src) || '.png';
          const filename = sanitizeFilename('img_' + assetId + ext);
          assets.push({ id: assetId, originalUrl: this.resolveUrl(src, url), filename, type: 'image', subdir: 'images' });
          $(el).attr('src', './assets/images/' + filename);
          $(el).attr('data-original-src', src);
        }
      });

      // Process CSS link tags
      $('link[rel="stylesheet"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && isValidUrl(this.resolveUrl(href, url))) {
          const assetId = generateId();
          const filename = sanitizeFilename('style_' + assetId + '.css');
          assets.push({ id: assetId, originalUrl: this.resolveUrl(href, url), filename, type: 'stylesheet', subdir: 'css' });
          $(el).attr('href', './assets/css/' + filename);
        }
      });

      // Process background images in inline styles
      $('[style]').each((_, el) => {
        const style = $(el).attr('style');
        if (style && style.includes('url(')) {
          const urlMatch = style.match(/url\(['"]?([^'")\s]+)['"]?\)/g);
          if (urlMatch) {
            let newStyle = style;
            urlMatch.forEach((match) => {
              const urlValue = match.replace(/url\(['"]?/, '').replace(/['"]?\)/, '');
              if (isValidUrl(this.resolveUrl(urlValue, url))) {
                const assetId = generateId();
                const ext = getFileExtension(urlValue) || '.png';
                const filename = sanitizeFilename('bg_' + assetId + ext);
                assets.push({ id: assetId, originalUrl: this.resolveUrl(urlValue, url), filename, type: 'image', subdir: 'images' });
                newStyle = newStyle.replace(urlValue, './assets/images/' + filename);
              }
            });
            $(el).attr('style', newStyle);
          }
        }
      });

      // Process script tags
      $('script[src]').each((_, el) => {
        const src = $(el).attr('src');
        if (src && isValidUrl(this.resolveUrl(src, url))) {
          const assetId = generateId();
          const filename = sanitizeFilename('script_' + assetId + '.js');
          assets.push({ id: assetId, originalUrl: this.resolveUrl(src, url), filename, type: 'script', subdir: 'js' });
          $(el).attr('src', './assets/js/' + filename);
        }
      });

      // Process font links
      $('link[href*="fonts"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && isValidUrl(this.resolveUrl(href, url))) {
          const assetId = generateId();
          const ext = getFileExtension(href) || '.css';
          const filename = sanitizeFilename('font_' + assetId + ext);
          assets.push({ id: assetId, originalUrl: this.resolveUrl(href, url), filename, type: 'font', subdir: 'fonts' });
          $(el).attr('href', './assets/fonts/' + filename);
        }
      });

      // Remove tracking scripts
      $('script[src*="google-analytics"]').remove();
      $('script[src*="googletagmanager"]').remove();
      $('script[src*="facebook"]').remove();
      $('script[src*="hotjar"]').remove();

      onProgress('downloading', 50, 'Downloading ' + assets.length + ' assets...');

      await this.downloadAssets(assets, projectId, (downloaded, total) => {
        const pct = 50 + Math.round((downloaded / Math.max(total, 1)) * 30);
        onProgress('downloading', pct, 'Downloaded ' + downloaded + '/' + total + ' assets');
      });

      onProgress('building', 85, 'Building project structure...');

      const bodyHtml = $('body').html() || '';
      const headContent = $('head').html() || '';
      let extractedCss = '';
      $('style').each((_, el) => { extractedCss += $(el).html() + '\n'; });
      let extractedJs = '';
      $('script:not([src])').each((_, el) => {
        const content = $(el).html();
        if (content && content.trim()) extractedJs += content + '\n';
      });

      const processedFullHtml = $.html();
      const frameworks = this.detectFrameworks($, fullHtml);

      onProgress('building', 90, 'Generating ZIP package...');
      await this.generateZip(projectId, processedFullHtml, extractedCss, extractedJs, assets);
      onProgress('complete', 100, 'Clone complete!');

      return {
        html: bodyHtml,
        css: extractedCss,
        js: extractedJs,
        fullHtml: processedFullHtml,
        headContent,
        assets,
        frameworks,
        thumbnailPath: '/uploads/' + projectId + '/thumbnail.png',
        zipPath: '/uploads/' + projectId + '/project.zip',
        meta: {
          title: $('title').text() || '',
          description: $('meta[name="description"]').attr('content') || '',
          ogImage: $('meta[property="og:image"]').attr('content') || '',
        },
      };
    } finally {
      await page.close();
    }
  }

  resolveUrl(assetUrl, baseUrl) {
    try {
      if (assetUrl.startsWith('data:')) return assetUrl;
      if (assetUrl.startsWith('//')) return 'https:' + assetUrl;
      if (assetUrl.startsWith('http')) return assetUrl;
      return new URL(assetUrl, baseUrl).href;
    } catch {
      return assetUrl;
    }
  }

  async downloadAssets(assets, projectId, onAssetProgress) {
    if (!onAssetProgress) onAssetProgress = function() {};
    const uploadDir = getUploadDir(projectId);
    const assetsDir = path.join(uploadDir, 'assets');

    for (const subdir of ['images', 'css', 'js', 'fonts']) {
      const dir = path.join(assetsDir, subdir);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    let downloaded = 0;
    const total = assets.filter((a) => !a.originalUrl.startsWith('data:')).length;

    for (let i = 0; i < assets.length; i += 5) {
      const batch = assets.slice(i, i + 5);
      const batchPromises = batch.map(async (asset) => {
        await this.downloadAsset(asset, assetsDir);
        downloaded++;
        onAssetProgress(downloaded, total);
      });
      await Promise.allSettled(batchPromises);
    }
  }

  downloadAsset(asset, assetsDir) {
    return new Promise((resolve) => {
      try {
        if (asset.originalUrl.startsWith('data:')) { resolve(); return; }
        const targetDir = asset.subdir ? path.join(assetsDir, asset.subdir) : assetsDir;
        const client = asset.originalUrl.startsWith('https') ? https : http;
        const request = client.get(asset.originalUrl, { timeout: 15000 }, (response) => {
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            this._followRedirect(response.headers.location, asset, targetDir, resolve, 0);
            return;
          }
          this.handleAssetResponse(response, asset, targetDir, resolve);
        });
        request.on('error', () => resolve());
        request.on('timeout', () => { request.destroy(); resolve(); });
      } catch { resolve(); }
    });
  }

  _followRedirect(location, asset, targetDir, resolve, depth) {
    if (depth >= 3) { resolve(); return; }
    try {
      const redirectUrl = location.startsWith('http') ? location : ('https:' + location);
      const redirectClient = redirectUrl.startsWith('https') ? https : http;
      redirectClient.get(redirectUrl, { timeout: 15000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          this._followRedirect(res.headers.location, asset, targetDir, resolve, depth + 1);
          return;
        }
        this.handleAssetResponse(res, asset, targetDir, resolve);
      }).on('error', () => resolve());
    } catch { resolve(); }
  }

  handleAssetResponse(response, asset, targetDir, resolve) {
    if (response.statusCode !== 200) { resolve(); return; }
    const chunks = [];
    response.on('data', (chunk) => chunks.push(chunk));
    response.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        if (buffer.length > 50 * 1024 * 1024) { resolve(); return; }
        const filePath = path.join(targetDir, asset.filename);
        fs.writeFileSync(filePath, buffer);
        asset.localPath = filePath;
        asset.size = buffer.length;
      } catch {}
      resolve();
    });
    response.on('error', () => resolve());
  }

  async generateZip(projectId, fullHtml, css, js, assets) {
    const uploadDir = getUploadDir(projectId);
    const zipPath = path.join(uploadDir, 'project.zip');

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 6 } });
      output.on('close', () => resolve(zipPath));
      archive.on('error', reject);
      archive.pipe(output);

      archive.append(fullHtml, { name: 'index.html' });
      if (css && css.trim()) archive.append(css, { name: 'assets/css/styles.css' });
      if (js && js.trim()) archive.append(js, { name: 'assets/js/scripts.js' });

      for (const asset of assets) {
        if (asset.localPath && fs.existsSync(asset.localPath)) {
          const subdir = asset.subdir || '';
          archive.file(asset.localPath, { name: 'assets/' + subdir + '/' + asset.filename });
        }
      }
      archive.finalize();
    });
  }

  detectFrameworks($, html) {
    const frameworks = [];
    if (html.includes('bootstrap') || $('link[href*="bootstrap"]').length > 0) frameworks.push('Bootstrap');
    if (html.includes('tailwind') || html.includes('tw-')) frameworks.push('TailwindCSS');
    if (html.includes('jquery') || $('script[src*="jquery"]').length > 0) frameworks.push('jQuery');
    if (html.includes('react') || html.includes('__next')) frameworks.push('React');
    if (html.includes('vue') || html.includes('__nuxt')) frameworks.push('Vue.js');
    if (html.includes('font-awesome') || $('link[href*="fontawesome"]').length > 0) frameworks.push('Font Awesome');
    return frameworks;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = new ClonerService();
