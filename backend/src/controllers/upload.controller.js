const uploadService = require('../services/upload.service');
const projectService = require('../services/project.service');
const pageService = require('../services/page.service');
const path = require('path');

async function uploadProject(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please upload a ZIP file.' });
    }

    const projectName = req.body.name || 'Uploaded Project';

    // Create project
    const project = projectService.createProject(req.user.id, {
      name: projectName,
      status: 'processing',
    });

    try {
      const result = uploadService.processZipUpload(req.file.path, project.id);

      // Extract CSS and JS from HTML for the editor
      const cheerio = require('cheerio');
      const $ = cheerio.load(result.html);

      let css = '';
      $('style').each((_, el) => { css += $(el).html() + '\n'; });

      let js = '';
      $('script:not([src])').each((_, el) => {
        const content = $(el).html();
        if (content && content.trim()) js += content + '\n';
      });

      const bodyHtml = $('body').html() || result.html;

      // Create page
      const page = pageService.createPage(project.id, {
        name: projectName,
        html: bodyHtml,
        css: css,
        js: js,
        meta: {
          title: $('title').text() || '',
          description: $('meta[name="description"]').attr('content') || '',
          fileCount: result.fileCount,
          totalSize: result.totalSize,
        },
      });

      projectService.updateProject(project.id, { status: 'ready' });

      res.json({
        project: projectService.getProjectById(project.id),
        page,
        files: result.fileCategories,
        fileCount: result.fileCount,
        totalSize: result.totalSize,
      });
    } catch (err) {
      projectService.updateProject(project.id, { status: 'failed' });
      if (err.message.includes('index.html')) {
        return res.status(400).json({ error: err.message });
      }
      throw err;
    }
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to process upload' });
  }
}

module.exports = { uploadProject };
