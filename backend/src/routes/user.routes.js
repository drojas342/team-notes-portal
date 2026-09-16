const express = require('express');
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = express.Router();

router.get('/', authMiddleware, requireRole('ADMIN'), userController.list);
router.post('/', authMiddleware, requireRole('ADMIN'), userController.create);
router.put('/:id', authMiddleware, requireRole('ADMIN'), userController.update);
router.patch('/:id/status', authMiddleware, requireRole('ADMIN'), userController.setStatus);

module.exports = router;
