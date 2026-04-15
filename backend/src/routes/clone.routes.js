const express = require('express');
const router = express.Router();
const { clonePage, getCloneStatus } = require('../controllers/clone.controller');
const { authMiddleware } = require('../middleware/auth');
const { cloneLimiter } = require('../middleware/rateLimiter');

router.post('/', authMiddleware, cloneLimiter, clonePage);
router.get('/status/:projectId', authMiddleware, getCloneStatus);

module.exports = router;
