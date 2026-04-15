const clonerService = require('../services/cloner.service');
const projectService = require('../services/project.service');
const pageService = require('../services/page.service');
const assetService = require('../services/asset.service');
const { isValidUrl, extractDomain } = require('../utils/helpers');

/**
 * POST /api/clone - Async clone, returns jobId immediately
 */
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

    // Send immediate 202 Accepted response
    res.status(202).json({
      message: 'Cloning started',
      project,
      jobId: project.id,
    });

    // Clone in background (after response is sent)
    try {
      const result = await clonerService.clonePage(url, project.id);

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

      // Emit Socket.IO event if available
      if (req.app.get('io')) {
        req.app.get('io').emit('clone:complete', {
          projectId: project.id,
          pageId: page.id,
          userId: req.user.id,
        });
      }
    } catch (cloneErr) {
      console.error('Clone failed:', cloneErr.message);
      projectService.updateProject(project.id, { status: 'failed' });

      // Emit Socket.IO failure event
      if (req.app.get('io')) {
        req.app.get('io').emit('clone:failed', {
          projectId: project.id,
          userId: req.user.id,
          error: cloneErr.message,
        });
      }
    }
  } catch (err) {
    console.error('Clone controller error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to start cloning' });
    }
  }
}

/**
 * POST /api/clone/stream - SSE endpoint for real-time clone progress
 * This is the primary method used by the frontend
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

    // Set up SSE with longer timeout
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send keepalive comments to prevent proxy/browser timeouts
    const keepAlive = setInterval(() => {
      try { res.write(': keepalive\n\n'); } catch {}
    }, 15000);

    // Handle client disconnect
    let clientDisconnected = false;
    req.on('close', () => {
      clientDisconnected = true;
      clearInterval(keepAlive);
    });

    const sendEvent = (data) => {
      if (clientDisconnected) return;
      try {
        res.write('data: ' + JSON.stringify(data) + '\n\n');
      } catch {}
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
      console.error('Clone failed:', cloneErr.message);
      projectService.updateProject(project.id, { status: 'failed' });
      sendEvent({
        stage: 'error',
        percent: 0,
        message: cloneErr.message || 'Clone failed. Please try a different URL.',
        projectId: project.id,
      });
    }

    clearInterval(keepAlive);
    if (!clientDisconnected) {
      res.end();
    }
  } catch (err) {
    console.error('Clone SSE error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to start cloning' });
    }
  }
}

/**
 * GET /api/clone/status/:projectId - Poll for clone status
 */
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
