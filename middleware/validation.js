const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value
    }));
    
    console.log('Validation errors:', errorMessages);
    
    return res.status(400).json({ 
      message: 'Validation failed',
      errors: errorMessages
    });
  }
  next();
};

module.exports = { validate };