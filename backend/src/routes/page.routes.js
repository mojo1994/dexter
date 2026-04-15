const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getPage,
  updatePage,
  createPage,
  deletePage,
  saveVersion,
  getVersions,
  restoreVersion,
  uploadAsset,
  getAssets,
} = require('../controllers/page.controller');
const { authMiddleware } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/svg+xml',
      'image/webp',
      'video/mp4',
      'video/webm',
      'font/woff',
      'font/woff2',
      'application/font-woff',
      'application/javascript',
      'text/css',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  },
});

// Page CRUD
router.get('/:id', authMiddleware, getPage);
router.put('/:id', authMiddleware, updatePage);
router.delete('/:id', authMiddleware, deletePage);

// Create page in project
router.post('/project/:projectId', authMiddleware, createPage);

// Versions
router.post('/:id/versions', authMiddleware, saveVersion);
router.get('/:id/versions', authMiddleware, getVersions);
router.post('/:id/versions/restore', authMiddleware, restoreVersion);

// Assets
router.post('/project/:projectId/assets', authMiddleware, upload.single('file'), uploadAsset);
router.get('/project/:projectId/assets', authMiddleware, getAssets);

module.exports = router;
