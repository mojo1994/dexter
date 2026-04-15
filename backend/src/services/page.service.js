const { db } = require('../config/database');
const { generateId } = require('../utils/helpers');

class PageService {
  createPage(projectId, data = {}) {
    const id = generateId();
    const stmt = db.prepare(`
      INSERT INTO pages (id, project_id, name, html, css, js, gjsData, meta_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      projectId,
      data.name || 'Untitled Page',
      data.html || '',
      data.css || '',
      data.js || '',
      JSON.stringify(data.gjsData || {}),
      JSON.stringify(data.meta || {})
    );

    return this.getPageById(id);
  }

  getPageById(id) {
    const stmt = db.prepare('SELECT * FROM pages WHERE id = ?');
    const page = stmt.get(id);
    if (page) {
      page.gjsData = JSON.parse(page.gjsData || '{}');
      page.meta_data = JSON.parse(page.meta_data || '{}');
    }
    return page;
  }

  getPagesByProject(projectId) {
    const stmt = db.prepare('SELECT * FROM pages WHERE project_id = ? ORDER BY created_at DESC');
    return stmt.all(projectId).map((page) => ({
      ...page,
      gjsData: JSON.parse(page.gjsData || '{}'),
      meta_data: JSON.parse(page.meta_data || '{}'),
    }));
  }

  updatePage(id, data) {
    const fields = [];
    const values = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.html !== undefined) {
      fields.push('html = ?');
      values.push(data.html);
    }
    if (data.css !== undefined) {
      fields.push('css = ?');
      values.push(data.css);
    }
    if (data.js !== undefined) {
      fields.push('js = ?');
      values.push(data.js);
    }
    if (data.gjsData !== undefined) {
      fields.push('gjsData = ?');
      values.push(JSON.stringify(data.gjsData));
    }
    if (data.meta_data !== undefined) {
      fields.push('meta_data = ?');
      values.push(JSON.stringify(data.meta_data));
    }
    if (data.published_url !== undefined) {
      fields.push('published_url = ?');
      values.push(data.published_url);
    }

    if (fields.length === 0) return this.getPageById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    fields.push('version = version + 1');
    values.push(id);

    const stmt = db.prepare(`UPDATE pages SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.getPageById(id);
  }

  saveVersion(pageId) {
    const page = this.getPageById(pageId);
    if (!page) return null;

    const id = generateId();
    const stmt = db.prepare(`
      INSERT INTO page_versions (id, page_id, html, css, js, gjsData, version)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, pageId, page.html, page.css, page.js, JSON.stringify(page.gjsData), page.version);
    return { id, version: page.version };
  }

  getVersions(pageId) {
    const stmt = db.prepare(
      'SELECT id, page_id, version, created_at FROM page_versions WHERE page_id = ? ORDER BY version DESC'
    );
    return stmt.all(pageId);
  }

  restoreVersion(pageId, versionId) {
    const versionStmt = db.prepare('SELECT * FROM page_versions WHERE id = ? AND page_id = ?');
    const version = versionStmt.get(versionId, pageId);

    if (!version) return null;

    // Save current as a new version first
    this.saveVersion(pageId);

    // Restore
    return this.updatePage(pageId, {
      html: version.html,
      css: version.css,
      js: version.js,
      gjsData: JSON.parse(version.gjsData || '{}'),
    });
  }

  deletePage(id) {
    const stmt = db.prepare('DELETE FROM pages WHERE id = ?');
    return stmt.run(id);
  }
}

module.exports = new PageService();
