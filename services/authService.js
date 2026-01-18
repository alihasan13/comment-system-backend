const jwt = require('jsonwebtoken');
const User = require('../models/user');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

const register = async ({ username, email, password }) => {
  const userExists = await User.findOne({ $or: [{ email }, { username }] });
  
  if (userExists) {
    throw new Error('User already exists');
  }
  
  const user = await User.create({
    username,
    email,
    password,
    avatar: `https://ui-avatars.com/api/?name=${username}&background=random`
  });
  
  return {
    token: generateToken(user._id),
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar
    }
  };
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password');
  
  if (!user || !(await user.matchPassword(password))) {
    throw new Error('Invalid email or password');
  }
  
  return {
    token: generateToken(user._id),
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar
    }
  };
};

module.exports = { register, login };