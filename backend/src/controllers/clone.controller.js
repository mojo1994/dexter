const clonerService = require('../services/cloner.service');
const projectService = require('../services/project.service');
const pageService = require('../services/page.service');
const assetService = require('../services/asset.service');
const { isValidUrl, extractDomain } = require('../utils/helpers');

async function clonePage(req, res) {
  try {
    const { url, name } = req.body;

    if (!url || !isValidUrl(url)) {
      return res.status(400).json({ error: 'A valid URL is required' });
    }

    const projectName = name || 'Clone of ' + extractDomain(url);

    // Create project
    const project = projectService.createProject(req.user.id, {
      name: projectName,
      url,
      status: 'cloning',
    });

    // Send initial response
    res.status(202).json({
      message: 'Cloning started',
      project,
    });

    // Clone in background (non-blocking after response)
    try {
      const result = await clonerService.clonePage(url, project.id);

      projectService.updateProject(project.id, {
        status: 'cloned',
        thumbnail: result.thumbnailPath,
      });

      pageService.createPage(project.id, {
        name: projectName,
        html: result.html,
        css: result.css,
        js: result.js,
        meta: result.meta,
      });

      for (const asset of result.assets) {
        try {
          assetService.saveClonedAsset(project.id, asset);
        } catch (err) {
          console.warn('Failed to save asset record:', err.message);
        }
      }
    } catch (cloneErr) {
      console.error('Clone failed:', cloneErr);
      projectService.updateProject(project.id, { status: 'failed' });
    }
  } catch (err) {
    console.error('Clone controller error:', err);
    res.status(500).json({ error: 'Failed to start cloning' });
  }
}

/**
 * SSE endpoint for real-time clone progress
 */
async function cloneWithProgress(req, res) {
  try {
    const { url, name } = req.body;

    if (!url || !isValidUrl(url)) {
      return res.status(400).json({ error: 'A valid URL is required' });
    }

    const projectName = name || 'Clone of ' + extractDomain(url);

    // Create project
    const project = projectService.createProject(req.user.id, {
      name: projectName,
      url,
      status: 'cloning',
    });

    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const sendEvent = (data) => {
      res.write('data: ' + JSON.stringify(data) + '\n\n');
    };

    sendEvent({ stage: 'started', percent: 0, message: 'Cloning started...', projectId: project.id });

    try {
      const result = await clonerService.clonePage(url, project.id, (stage, percent, message) => {
        sendEvent({ stage, percent, message, projectId: project.id });
      });

      projectService.updateProject(project.id, {
        status: 'cloned',
        thumbnail: result.thumbnailPath,
      });

      const page = pageService.createPage(project.id, {
        name: projectName,
        html: result.html,
        css: result.css,
        js: result.js,
        meta: result.meta,
      });

      for (const asset of result.assets) {
        try {
          assetService.saveClonedAsset(project.id, asset);
        } catch (err) {
          console.warn('Failed to save asset record:', err.message);
        }
      }

      sendEvent({
        stage: 'complete',
        percent: 100,
        message: 'Clone complete!',
        projectId: project.id,
        pageId: page.id,
        frameworks: result.frameworks,
        assetCount: result.assets.length,
        zipPath: result.zipPath,
      });
    } catch (cloneErr) {
      console.error('Clone failed:', cloneErr);
      projectService.updateProject(project.id, { status: 'failed' });
      sendEvent({ stage: 'error', percent: 0, message: cloneErr.message || 'Clone failed', projectId: project.id });
    }

    res.end();
  } catch (err) {
    console.error('Clone SSE error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to start cloning' });
    }
  }
}

async function getCloneStatus(req, res) {
  try {
    const { projectId } = req.params;
    const project = projectService.getProjectById(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const pages = pageService.getPagesByProject(projectId);

    res.json({
      project,
      pages,
      ready: project.status === 'cloned',
    });
  } catch (err) {
    console.error('Clone status error:', err);
    res.status(500).json({ error: 'Failed to get clone status' });
  }
}

module.exports = { clonePage, cloneWithProgress, getCloneStatus };
