import logger from '../utils/logger.js';
import config from '../config/index.js';

class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

const handleValidationError = (error) => {
  const message = error.details ? 
    error.details.map(detail => detail.message).join(', ') :
    'Validation failed';
  
  return new AppError(message, 400);
};

const handleDuplicateKeyError = (error) => {
  const field = error.message.match(/Duplicate entry '(.+?)' for key/)?.[1];
  const message = field ? 
    `Duplicate value for ${field}` : 
    'Duplicate entry found';
  
  return new AppError(message, 409);
};

const handleOpenAIError = (error) => {
  if (error.status === 401) {
    return new AppError('Invalid OpenAI API key', 401);
  } else if (error.status === 429) {
    return new AppError('OpenAI rate limit exceeded', 429);
  } else if (error.status === 400) {
    return new AppError('Invalid request to OpenAI API', 400);
  }
  
  return new AppError('OpenAI service error', 502);
};

const handleDatabaseError = (error) => {
  if (error.message.includes('Connection')) {
    return new AppError('Database connection failed', 503);
  } else if (error.message.includes('timeout')) {
    return new AppError('Database operation timed out', 504);
  }
  
  return new AppError('Database error occurred', 500);
};

const sendErrorDev = (err, res) => {
  const errorObj = {
    name: err.name,
    message: err.message,
    statusCode: err.statusCode,
    isOperational: err.isOperational,
    stack: err.stack
  };
  
  if (err.response?.status) {
    errorObj.responseStatus = err.response.status;
  }
  
  res.status(err.statusCode).json({
    status: 'error',
    error: errorObj,
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });
};

const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      timestamp: new Date().toISOString()
    });
  } else {
    logger.logError(err, { type: 'UNHANDLED_ERROR' });
    
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong',
      timestamp: new Date().toISOString()
    });
  }
};

const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  
  logger.logError(err, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    statusCode: err.statusCode
  });
  
  let error = { ...err };
  error.message = err.message;
  
  if (err.name === 'ValidationError') {
    error = handleValidationError(err);
  } else if (err.message.includes('Duplicate entry')) {
    error = handleDuplicateKeyError(err);
  } else if (err.name === 'OpenAIError' || err.message.includes('OpenAI')) {
    error = handleOpenAIError(err);
  } else if (err.name === 'DatabaseError' || err.message.includes('database')) {
    error = handleDatabaseError(err);
  }
  
  if (config.env === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

export {
  AppError,
  globalErrorHandler,
  asyncHandler,
  notFoundHandler
};