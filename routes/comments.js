const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { validate } = require('../middleware/validation');
const { protect } = require('../middleware/auth');
const { checkCommentOwnership } = require('../middleware/ownership');
const commentService = require('../services/commentService');

// Get all comments (public route)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = 'newest' } = req.query;
    const result = await commentService.getComments({ page, limit, sort });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single comment (public route)
router.get('/:id', async (req, res) => {
  try {
    const comment = await commentService.getCommentById(req.params.id);
    res.json(comment);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// Create comment (protected route)
router.post('/', protect, [
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Content is required')
    .isLength({ max: 1000 })
    .withMessage('Content cannot exceed 1000 characters'),
  body('parentComment')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid parent comment ID')
], validate, async (req, res) => {
  try {
    const comment = await commentService.createComment({
      content: req.body.content,
      author: req.user._id,
      parentComment: req.body.parentComment || null
    });
    
    req.app.get('io').emit('comment:created', comment);
    
    res.status(201).json(comment);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update comment (protected route + ownership check)
router.put('/:id', protect, checkCommentOwnership, [
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Content is required')
    .isLength({ max: 1000 })
    .withMessage('Content cannot exceed 1000 characters')
], validate, async (req, res) => {
  try {
    const comment = await commentService.updateComment(
      req.params.id,
      req.user._id,
      req.body.content
    );
    
    req.app.get('io').emit('comment:updated', comment);
    
    res.json(comment);
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(403).json({ message: error.message });
  }
});

// Delete comment (protected route + ownership check)
router.delete('/:id', protect, checkCommentOwnership, async (req, res) => {
  try {
    await commentService.deleteComment(req.params.id, req.user._id);
    
    req.app.get('io').emit('comment:deleted', { id: req.params.id });
    
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(403).json({ message: error.message });
  }
});

// Like comment (protected route)
router.post('/:id/like', protect, async (req, res) => {
  try {
    const comment = await commentService.toggleLike(req.params.id, req.user._id);
    
    req.app.get('io').emit('comment:liked', comment);
    
    res.json(comment);
  } catch (error) {
    console.error('Error liking comment:', error);
    res.status(400).json({ message: error.message });
  }
});

// Dislike comment (protected route)
router.post('/:id/dislike', protect, async (req, res) => {
  try {
    const comment = await commentService.toggleDislike(req.params.id, req.user._id);
    
    req.app.get('io').emit('comment:disliked', comment);
    
    res.json(comment);
  } catch (error) {
    console.error('Error disliking comment:', error);
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;