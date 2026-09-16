const express = require('express');
const noteController = require('../controllers/note.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', authMiddleware, noteController.list);
router.post('/', authMiddleware, noteController.create);
router.put('/:id', authMiddleware, noteController.update);
router.patch('/:id/position', authMiddleware, noteController.updatePosition);
router.delete('/:id', authMiddleware, noteController.remove);

module.exports = router;
