import { body, param, query, validationResult } from 'express-validator';
import { AppError } from './errorHandler.js';

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => 
      `${error.path}: ${error.msg}`
    ).join(', ');
    
    throw new AppError(errorMessages, 400);
  }
  
  next();
};


const validateSessionId = [
  param('sessionId')
    .isUUID()
    .withMessage('Session ID must be a valid UUID'),
  
  handleValidationErrors
];

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

const validateWorkflowType = [
  body('workflowType')
    .optional()
    .isIn(['document_analysis', 'content_research', 'knowledge_synthesis'])
    .withMessage('Workflow type must be one of: document_analysis, content_research, knowledge_synthesis'),
  
  handleValidationErrors
];

const sanitizeInput = (req, res, next) => {
  // Remove any potential XSS or injection attempts
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .trim();
    } else if (Array.isArray(obj)) {
      return obj.map(sanitize);
    } else if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitize(value);
      }
      return sanitized;
    }
    return obj;
  };
  
  if (req.body) {
    req.body = sanitize(req.body);
  }
  
  if (req.query) {
    req.query = sanitize(req.query);
  }
  
  next();
};

export {
  validateSessionId,
  validatePagination,
  validateWorkflowType,
  sanitizeInput,
  handleValidationErrors
};