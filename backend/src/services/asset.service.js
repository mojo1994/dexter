const path = require('path');
const fs = require('fs');
const { db } = require('../config/database');
const { generateId, getUploadDir, sanitizeFilename } = require('../utils/helpers');

class AssetService {
  saveAsset(projectId, file) {
    const id = generateId();
    const uploadDir = getUploadDir(projectId);
    const assetsDir = path.join(uploadDir, 'assets');

    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    const filename = sanitizeFilename(`${id}_${file.originalname}`);
    const filePath = path.join(assetsDir, filename);

    fs.writeFileSync(filePath, file.buffer);

    const stmt = db.prepare(`
      INSERT INTO assets (id, project_id, filename, local_path, mime_type, size)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, projectId, filename, filePath, file.mimetype, file.size);

    return {
      id,
      filename,
      url: `/uploads/${projectId}/assets/${filename}`,
      mime_type: file.mimetype,
      size: file.size,
    };
  }

  saveClonedAsset(projectId, assetData) {
    const id = assetData.id || generateId();

    const stmt = db.prepare(`
      INSERT INTO assets (id, project_id, filename, original_url, local_path, mime_type, size)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      projectId,
      assetData.filename,
      assetData.originalUrl || '',
      assetData.localPath || '',
      assetData.mimeType || '',
      assetData.size || 0
    );

    return { id, filename: assetData.filename };
  }

  getAssetsByProject(projectId) {
    const stmt = db.prepare('SELECT * FROM assets WHERE project_id = ? ORDER BY created_at DESC');
    return stmt.all(projectId);
  }

  deleteAsset(id) {
    const stmt = db.prepare('SELECT * FROM assets WHERE id = ?');
    const asset = stmt.get(id);

    if (asset && asset.local_path && fs.existsSync(asset.local_path)) {
      fs.unlinkSync(asset.local_path);
    }

    const deleteStmt = db.prepare('DELETE FROM assets WHERE id = ?');
    return deleteStmt.run(id);
  }
}

module.exports = new AssetService();
