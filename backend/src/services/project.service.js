const { db } = require('../config/database');
const { generateId } = require('../utils/helpers');

class ProjectService {
  createProject(userId, data) {
    const id = generateId();
    const stmt = db.prepare(`
      INSERT INTO projects (id, user_id, name, url_original, status, thumbnail)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      userId,
      data.name || 'Untitled Project',
      data.url || null,
      data.status || 'draft',
      data.thumbnail || null
    );

    return this.getProjectById(id);
  }

  getProjectById(id) {
    const stmt = db.prepare('SELECT * FROM projects WHERE id = ?');
    return stmt.get(id);
  }

  getProjectsByUser(userId, options = {}) {
    const { limit = 50, offset = 0, status } = options;
    let query = 'SELECT * FROM projects WHERE user_id = ?';
    const params = [userId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = db.prepare(query);
    return stmt.all(...params);
  }

  getProjectCount(userId) {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM projects WHERE user_id = ?');
    return stmt.get(userId).count;
  }

  updateProject(id, data) {
    const fields = [];
    const values = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.thumbnail !== undefined) {
      fields.push('thumbnail = ?');
      values.push(data.thumbnail);
    }

    if (fields.length === 0) return this.getProjectById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.getProjectById(id);
  }

  deleteProject(id) {
    const stmt = db.prepare('DELETE FROM projects WHERE id = ?');
    return stmt.run(id);
  }
}

module.exports = new ProjectService();
