const logger = require('../utils/logger');

const notFoundHandler = (req, res) => {
  res.status(404).json({ message: 'Route not found' });
};

const errorHandler = (err, req, res, next) => {
  logger.error(
    {
      err: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
      path: req.path,
      method: req.method,
    },
    'Unhandled application error'
  );

  if (res.headersSent) {
    return next(err);
  }

  // Upload errors (file too large, too many files...) are client errors.
  if (err.name === 'MulterError') {
    return res.status(400).json({ message: `Upload rejected: ${err.code}` });
  }

  return res.status(err.statusCode || 500).json({
    message: err.publicMessage || 'Internal server error',
  });
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
