const { body, validationResult } = require('express-validator');

const requests = {
  subscribers: [
    body('name')
      .notEmpty()
      .isLength({ min: 1 })
      .withMessage('Name is required'),
    body('email')
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Email is not valid'),
    body('subs_date')
      .notEmpty()
      .withMessage('Subs Date is required')
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('Invalid date format. Use YYYY-MM-DD format'),
    body('description')
      .notEmpty()
      .isLength({ min: 1 })
      .withMessage('Description is required'),
  ],
};
const validator = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      message: errors.array(),
    });
  } else {
    next();
  }
};

module.exports = { requests, validator };
