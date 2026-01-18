const Comment = require('../models/Comment');

const getComments = async ({ page, limit, sort }) => {
  const skip = (page - 1) * limit;
  let sortOption = {};
  
  switch(sort) {
    case 'mostLiked':
      sortOption = { likes: -1 };
      break;
    case 'mostDisliked':
      sortOption = { dislikes: -1 };
      break;
    case 'newest':
    default:
      sortOption = { createdAt: -1 };
  }
  
  const comments = await Comment.find({ parentComment: null })
    .populate('author', 'username avatar')
    .populate({
      path: 'replies',
      populate: { path: 'author', select: 'username avatar' }
    })
    .sort(sortOption)
    .skip(skip)
    .limit(parseInt(limit));
  
  const total = await Comment.countDocuments({ parentComment: null });
  
  return {
    comments,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

const getCommentById = async (id) => {
  const comment = await Comment.findById(id)
    .populate('author', 'username avatar')
    .populate({
      path: 'replies',
      populate: { path: 'author', select: 'username avatar' }
    });
  
  if (!comment) {
    throw new Error('Comment not found');
  }
  
  return comment;
};

const createComment = async ({ content, author, parentComment }) => {
  const comment = await Comment.create({
    content,
    author,
    parentComment: parentComment || null
  });
  
  if (parentComment) {
    await Comment.findByIdAndUpdate(
      parentComment,
      { $push: { replies: comment._id } }
    );
  }
  
  return await comment.populate('author', 'username avatar');
};

const updateComment = async (commentId, userId, content) => {
  const comment = await Comment.findById(commentId);
  
  if (!comment) {
    throw new Error('Comment not found');
  }
  
  if (comment.author.toString() !== userId.toString()) {
    throw new Error('Not authorized to update this comment');
  }
  
  comment.content = content;
  comment.isEdited = true;
  comment.editedAt = new Date();
  
  await comment.save();
  
  return await comment.populate('author', 'username avatar');
};

const deleteComment = async (commentId, userId) => {
  const comment = await Comment.findById(commentId);
  
  if (!comment) {
    throw new Error('Comment not found');
  }
  
  if (comment.author.toString() !== userId.toString()) {
    throw new Error('Not authorized to delete this comment');
  }
  
  await Comment.deleteMany({ parentComment: commentId });
  
  if (comment.parentComment) {
    await Comment.findByIdAndUpdate(
      comment.parentComment,
      { $pull: { replies: commentId } }
    );
  }
  
  await comment.deleteOne();
};

const toggleLike = async (commentId, userId) => {
  const comment = await Comment.findById(commentId);
  
  if (!comment) {
    throw new Error('Comment not found');
  }
  
  const hasLiked = comment.likes.includes(userId);
  const hasDisliked = comment.dislikes.includes(userId);
  
  if (hasDisliked) {
    comment.dislikes = comment.dislikes.filter(id => id.toString() !== userId.toString());
  }
  
  if (hasLiked) {
    comment.likes = comment.likes.filter(id => id.toString() !== userId.toString());
  } else {
    comment.likes.push(userId);
  }
  
  await comment.save();
  
  // IMPORTANT: Populate author and replies with author
  return await comment.populate([
    { path: 'author', select: 'username avatar' },
    { path: 'replies', populate: { path: 'author', select: 'username avatar' } }
  ]);
};

const toggleDislike = async (commentId, userId) => {
  const comment = await Comment.findById(commentId);
  
  if (!comment) {
    throw new Error('Comment not found');
  }
  
  const hasLiked = comment.likes.includes(userId);
  const hasDisliked = comment.dislikes.includes(userId);
  
  if (hasLiked) {
    comment.likes = comment.likes.filter(id => id.toString() !== userId.toString());
  }
  
  if (hasDisliked) {
    comment.dislikes = comment.dislikes.filter(id => id.toString() !== userId.toString());
  } else {
    comment.dislikes.push(userId);
  }
  
  await comment.save();
  
  // IMPORTANT: Populate author and replies with author
  return await comment.populate([
    { path: 'author', select: 'username avatar' },
    { path: 'replies', populate: { path: 'author', select: 'username avatar' } }
  ]);
};

module.exports = {
  getComments,
  getCommentById,
  createComment,
  updateComment,
  deleteComment,
  toggleLike,
  toggleDislike
};