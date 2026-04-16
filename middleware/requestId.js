const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const requestId = (req, res, next) => {
  // Generate or use existing request ID
  req.requestId = req.headers['x-request-id'] || uuidv4();
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.requestId);
  
  // Log request start
  logger.info('Request started', {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length')
  });
  
  // Override res.end to log request completion
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    logger.info('Request completed', {
      requestId: req.requestId,
      statusCode: res.statusCode,
      contentLength: res.get('Content-Length')
    });
    
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

module.exports = requestId;
