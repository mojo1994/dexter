const projectService = require('../services/project.service');
const pageService = require('../services/page.service');
const assetService = require('../services/asset.service');
const archiver = require('archiver');

function getProjects(req, res) {
  try {
    const { status, limit, offset } = req.query;
    const projects = projectService.getProjectsByUser(req.user.id, {
      status,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
    });

    const total = projectService.getProjectCount(req.user.id);

    res.json({ projects, total });
  } catch (err) {
    console.error('Get projects error:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
}

function getProject(req, res) {
  try {
    const project = projectService.getProjectById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (project.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const pages = pageService.getPagesByProject(project.id);

    res.json({ project, pages });
  } catch (err) {
    console.error('Get project error:', err);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
}

function createProject(req, res) {
  try {
    const { name } = req.body;
    const project = projectService.createProject(req.user.id, { name: name || 'Untitled Project' });

    // Create a default blank page
    const page = pageService.createPage(project.id, { name: 'Home' });

    res.status(201).json({ project, page });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
}

function updateProject(req, res) {
  try {
    const project = projectService.getProjectById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (project.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = projectService.updateProject(req.params.id, req.body);
    res.json({ project: updated });
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
}

function deleteProject(req, res) {
  try {
    const project = projectService.getProjectById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (project.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    projectService.deleteProject(req.params.id);
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
}

async function exportProject(req, res) {
  try {
    const project = projectService.getProjectById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (project.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const pages = pageService.getPagesByProject(project.id);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${project.name.replace(/[^a-zA-Z0-9]/g, '_')}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    // Add each page as HTML file
    for (const page of pages) {
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${page.name || project.name}</title>
  <style>
${page.css || ''}
  </style>
</head>
<body>
${page.html || ''}
  <script>
${page.js || ''}
  </script>
</body>
</html>`;
      const filename = `${page.name.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
      archive.append(htmlContent, { name: filename });
    }

    await archive.finalize();
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export project' });
  }
}

module.exports = { getProjects, getProject, createProject, updateProject, deleteProject, exportProject };
