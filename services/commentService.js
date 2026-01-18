const Comment = require('../models/comment');

const getComments = async ({ page, limit, sort }) => {
  const skip = (page - 1) * limit;
  
  // Build aggregation pipeline
  let pipeline = [
    // Match only top-level comments
    { $match: { parentComment: null } }
  ];
  
  // Add sorting stage based on sort parameter
  if (sort === 'mostLiked') {
    pipeline.push({
      $addFields: {
        likeCount: { $size: '$likes' }
      }
    });
    pipeline.push({ $sort: { likeCount: -1, createdAt: -1 } });
  } else if (sort === 'mostDisliked') {
    pipeline.push({
      $addFields: {
        dislikeCount: { $size: '$dislikes' }
      }
    });
    pipeline.push({ $sort: { dislikeCount: -1, createdAt: -1 } });
  } else {
    // Default: newest first
    pipeline.push({ $sort: { createdAt: -1 } });
  }
  
  // Add pagination
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: parseInt(limit) });
  
  // Populate author
  pipeline.push({
    $lookup: {
      from: 'users',
      localField: 'author',
      foreignField: '_id',
      as: 'author'
    }
  });
  pipeline.push({
    $unwind: '$author'
  });
  
  // Populate replies
  pipeline.push({
    $lookup: {
      from: 'comments',
      localField: 'replies',
      foreignField: '_id',
      as: 'replies'
    }
  });
  
  // Populate author for each reply
  pipeline.push({
    $lookup: {
      from: 'users',
      localField: 'replies.author',
      foreignField: '_id',
      as: 'replyAuthors'
    }
  });
  
  // Map reply authors back to replies
  pipeline.push({
    $addFields: {
      replies: {
        $map: {
          input: '$replies',
          as: 'reply',
          in: {
            $mergeObjects: [
              '$$reply',
              {
                author: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$replyAuthors',
                        cond: { $eq: ['$$this._id', '$$reply.author'] }
                      }
                    },
                    0
                  ]
                }
              }
            ]
          }
        }
      }
    }
  });
  
  // Remove temporary field
  pipeline.push({
    $project: {
      replyAuthors: 0
    }
  });
  
  // Select only needed author fields
  pipeline.push({
    $project: {
      content: 1,
      author: {
        _id: 1,
        username: 1,
        avatar: 1
      },
      parentComment: 1,
      likes: 1,
      dislikes: 1,
      replies: {
        _id: 1,
        content: 1,
        author: {
          _id: 1,
          username: 1,
          avatar: 1
        },
        likes: 1,
        dislikes: 1,
        isEdited: 1,
        editedAt: 1,
        createdAt: 1,
        updatedAt: 1
      },
      isEdited: 1,
      editedAt: 1,
      createdAt: 1,
      updatedAt: 1,
      likeCount: 1,
      dislikeCount: 1
    }
  });
  
  // Execute aggregation
  const comments = await Comment.aggregate(pipeline);
  
  // Get total count
  const total = await Comment.countDocuments({ parentComment: null });
  
  return {
    comments,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1
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