const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  const requestId = req.headers['x-request-id'] || 'unknown';
  
  let error = { ...err };
  error.message = err.message;

  // Log to console and file with structured data
  logger.error('API Error occurred', {
    requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    errorName: err.name,
    errorMessage: err.message,
    stack: err.stack,
    body: req.method !== 'GET' ? req.body : undefined,
    query: req.query,
    params: req.params
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
    
    logger.warn('CastError handled', {
      requestId,
      originalError: err.message,
      value: err.value,
      path: err.path
    });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
    
    logger.warn('DuplicateKeyError handled', {
      requestId,
      keyValue: err.keyValue,
      index: err.index,
      code: err.code
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
    
    logger.warn('ValidationError handled', {
      requestId,
      validationErrors: Object.keys(err.errors).reduce((acc, key) => {
        acc[key] = err.errors[key].message;
        return acc;
      }, {})
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
    
    logger.warn('JWT Error handled', {
      requestId,
      errorType: 'JsonWebTokenError',
      errorMessage: err.message
    });
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
    
    logger.warn('JWT Error handled', {
      requestId,
      errorType: 'TokenExpiredError',
      expiredAt: err.expiredAt
    });
  }
  
  logger.info('Error response sent', {
    requestId,
    statusCode: error.statusCode || 500,
    message: error.message || 'Server Error'
  });

  res.status(error.statusCode || 500).json({
    status: 'error',
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      requestId 
    })
  });
};

module.exports = errorHandler;
