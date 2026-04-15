const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');
const { generateId, getUploadDir, sanitizeFilename, isValidUrl, getFileExtension } = require('../utils/helpers');

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
        timeout: parseInt(process.env.PUPPETEER_TIMEOUT, 10) || 30000,
      });
    }
    return this.browser;
  }

  async clonePage(url, projectId) {
    if (!isValidUrl(url)) {
      throw new Error('Invalid URL provided');
    }

    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Set viewport
      await page.setViewport({ width: 1440, height: 900 });

      // Set user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Navigate to URL
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: parseInt(process.env.PUPPETEER_TIMEOUT, 10) || 30000,
      });

      // Wait for page to fully render
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Get the full rendered HTML
      const fullHtml = await page.content();

      // Take a screenshot for thumbnail
      const uploadDir = getUploadDir(projectId);
      const thumbnailPath = path.join(uploadDir, 'thumbnail.png');
      await page.screenshot({
        path: thumbnailPath,
        type: 'png',
        fullPage: false,
      });

      // Extract and process HTML
      const $ = cheerio.load(fullHtml);

      // Collect all asset URLs
      const assets = [];

      // Process images
      $('img').each((_, el) => {
        const src = $(el).attr('src');
        if (src && isValidUrl(this.resolveUrl(src, url))) {
          const assetId = generateId();
          const ext = getFileExtension(src) || '.png';
          const filename = sanitizeFilename(`img_${assetId}${ext}`);
          assets.push({
            id: assetId,
            originalUrl: this.resolveUrl(src, url),
            filename,
            type: 'image',
          });
          $(el).attr('src', `./assets/${filename}`);
          $(el).attr('data-original-src', src);
        }
      });

      // Process CSS link tags
      const inlineStyles = [];
      $('link[rel="stylesheet"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && isValidUrl(this.resolveUrl(href, url))) {
          const assetId = generateId();
          const filename = sanitizeFilename(`style_${assetId}.css`);
          assets.push({
            id: assetId,
            originalUrl: this.resolveUrl(href, url),
            filename,
            type: 'stylesheet',
          });
          $(el).attr('href', `./assets/${filename}`);
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
                const filename = sanitizeFilename(`bg_${assetId}${ext}`);
                assets.push({
                  id: assetId,
                  originalUrl: this.resolveUrl(urlValue, url),
                  filename,
                  type: 'image',
                });
                newStyle = newStyle.replace(urlValue, `./assets/${filename}`);
              }
            });
            $(el).attr('style', newStyle);
          }
        }
      });

      // Extract inline styles
      $('style').each((_, el) => {
        inlineStyles.push($(el).html());
      });

      // Process script tags
      $('script[src]').each((_, el) => {
        const src = $(el).attr('src');
        if (src && isValidUrl(this.resolveUrl(src, url))) {
          const assetId = generateId();
          const filename = sanitizeFilename(`script_${assetId}.js`);
          assets.push({
            id: assetId,
            originalUrl: this.resolveUrl(src, url),
            filename,
            type: 'script',
          });
          $(el).attr('src', `./assets/${filename}`);
        }
      });

      // Remove tracking scripts and unwanted elements
      $('script[src*="google-analytics"]').remove();
      $('script[src*="googletagmanager"]').remove();
      $('script[src*="facebook"]').remove();
      $('script[src*="hotjar"]').remove();

      // Extract separated content
      const bodyHtml = $('body').html() || '';
      const headContent = $('head').html() || '';

      // Extract CSS from style tags
      let extractedCss = '';
      $('style').each((_, el) => {
        extractedCss += $(el).html() + '\n';
      });

      // Extract inline scripts
      let extractedJs = '';
      $('script:not([src])').each((_, el) => {
        const content = $(el).html();
        if (content && content.trim()) {
          extractedJs += content + '\n';
        }
      });

      // Download assets
      await this.downloadAssets(assets, projectId, page);

      // Detect frameworks
      const frameworks = this.detectFrameworks($, fullHtml);

      return {
        html: bodyHtml,
        css: extractedCss,
        js: extractedJs,
        fullHtml: $.html(),
        headContent,
        assets,
        frameworks,
        thumbnailPath: `/uploads/${projectId}/thumbnail.png`,
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
      if (assetUrl.startsWith('//')) return `https:${assetUrl}`;
      if (assetUrl.startsWith('http')) return assetUrl;
      return new URL(assetUrl, baseUrl).href;
    } catch {
      return assetUrl;
    }
  }

  async downloadAssets(assets, projectId, page) {
    const uploadDir = getUploadDir(projectId);
    const assetsDir = path.join(uploadDir, 'assets');

    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    const downloadPromises = assets.map(async (asset) => {
      try {
        if (asset.originalUrl.startsWith('data:')) return;

        const response = await page.goto(asset.originalUrl, {
          waitUntil: 'networkidle2',
          timeout: 10000,
        });

        if (response && response.ok()) {
          const buffer = await response.buffer();
          const filePath = path.join(assetsDir, asset.filename);
          fs.writeFileSync(filePath, buffer);
          asset.localPath = filePath;
          asset.size = buffer.length;
        }
      } catch (err) {
        console.warn(`Failed to download asset: ${asset.originalUrl}`, err.message);
      }
    });

    // Download in batches of 5
    for (let i = 0; i < downloadPromises.length; i += 5) {
      await Promise.allSettled(downloadPromises.slice(i, i + 5));
    }
  }

  detectFrameworks($, html) {
    const frameworks = [];

    if (html.includes('bootstrap') || $('link[href*="bootstrap"]').length > 0) {
      frameworks.push('Bootstrap');
    }
    if (html.includes('tailwind') || html.includes('tw-')) {
      frameworks.push('TailwindCSS');
    }
    if (html.includes('jquery') || typeof $ !== 'undefined') {
      frameworks.push('jQuery');
    }
    if (html.includes('react') || html.includes('__next')) {
      frameworks.push('React');
    }
    if (html.includes('vue') || html.includes('__nuxt')) {
      frameworks.push('Vue.js');
    }
    if (html.includes('font-awesome') || $('link[href*="fontawesome"]').length > 0) {
      frameworks.push('Font Awesome');
    }

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
