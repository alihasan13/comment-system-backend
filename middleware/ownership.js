const Comment = require('../models/comment');

const checkCommentOwnership = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Check if the logged-in user is the author of the comment
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        message: 'Access denied. You can only edit or delete your own comments.' 
      });
    }
    
    // Attach comment to request for use in route handler
    req.comment = comment;
    next();
  } catch (error) {
    console.error('Ownership check error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { checkCommentOwnership };