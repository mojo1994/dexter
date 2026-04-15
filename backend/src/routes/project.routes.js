const express = require('express');
const router = express.Router();
const {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  exportProject,
} = require('../controllers/project.controller');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, getProjects);
router.post('/', authMiddleware, createProject);
router.get('/:id', authMiddleware, getProject);
router.put('/:id', authMiddleware, updateProject);
router.delete('/:id', authMiddleware, deleteProject);
router.get('/:id/export', authMiddleware, exportProject);

module.exports = router;
