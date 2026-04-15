const pageService = require('../services/page.service');
const assetService = require('../services/asset.service');
const projectService = require('../services/project.service');

function getPage(req, res) {
  try {
    const page = pageService.getPageById(req.params.id);
    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    // Verify ownership
    const project = projectService.getProjectById(page.project_id);
    if (!project || project.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ page });
  } catch (err) {
    console.error('Get page error:', err);
    res.status(500).json({ error: 'Failed to fetch page' });
  }
}

function updatePage(req, res) {
  try {
    const page = pageService.getPageById(req.params.id);
    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    // Verify ownership
    const project = projectService.getProjectById(page.project_id);
    if (!project || project.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = pageService.updatePage(req.params.id, req.body);
    res.json({ page: updated });
  } catch (err) {
    console.error('Update page error:', err);
    res.status(500).json({ error: 'Failed to update page' });
  }
}

function createPage(req, res) {
  try {
    const { projectId } = req.params;
    const project = projectService.getProjectById(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (project.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const page = pageService.createPage(projectId, req.body);
    res.status(201).json({ page });
  } catch (err) {
    console.error('Create page error:', err);
    res.status(500).json({ error: 'Failed to create page' });
  }
}

function deletePage(req, res) {
  try {
    const page = pageService.getPageById(req.params.id);
    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const project = projectService.getProjectById(page.project_id);
    if (!project || project.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    pageService.deletePage(req.params.id);
    res.json({ message: 'Page deleted successfully' });
  } catch (err) {
    console.error('Delete page error:', err);
    res.status(500).json({ error: 'Failed to delete page' });
  }
}

function saveVersion(req, res) {
  try {
    const page = pageService.getPageById(req.params.id);
    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const project = projectService.getProjectById(page.project_id);
    if (!project || project.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const version = pageService.saveVersion(req.params.id);
    res.json({ version });
  } catch (err) {
    console.error('Save version error:', err);
    res.status(500).json({ error: 'Failed to save version' });
  }
}

function getVersions(req, res) {
  try {
    const page = pageService.getPageById(req.params.id);
    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const project = projectService.getProjectById(page.project_id);
    if (!project || project.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const versions = pageService.getVersions(req.params.id);
    res.json({ versions });
  } catch (err) {
    console.error('Get versions error:', err);
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
}

function restoreVersion(req, res) {
  try {
    const pageData = pageService.getPageById(req.params.id);
    if (!pageData) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const project = projectService.getProjectById(pageData.project_id);
    if (!project || project.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { versionId } = req.body;
    const page = pageService.restoreVersion(req.params.id, versionId);

    if (!page) {
      return res.status(404).json({ error: 'Version not found' });
    }

    res.json({ page });
  } catch (err) {
    console.error('Restore version error:', err);
    res.status(500).json({ error: 'Failed to restore version' });
  }
}

function uploadAsset(req, res) {
  try {
    const { projectId } = req.params;
    const project = projectService.getProjectById(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (project.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const asset = assetService.saveAsset(projectId, req.file);
    res.status(201).json({ asset });
  } catch (err) {
    console.error('Upload asset error:', err);
    res.status(500).json({ error: 'Failed to upload asset' });
  }
}

function getAssets(req, res) {
  try {
    const { projectId } = req.params;
    const project = projectService.getProjectById(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (project.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const assets = assetService.getAssetsByProject(projectId);
    res.json({
      assets: assets.map((a) => ({
        ...a,
        url: `/uploads/${projectId}/assets/${a.filename}`,
      })),
    });
  } catch (err) {
    console.error('Get assets error:', err);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
}

module.exports = {
  getPage,
  updatePage,
  createPage,
  deletePage,
  saveVersion,
  getVersions,
  restoreVersion,
  uploadAsset,
  getAssets,
};
