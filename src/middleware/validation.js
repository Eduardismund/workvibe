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

const validateDocumentUpload = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters'),
  
  body('sourceType')
    .optional()
    .isIn(['upload', 'web', 'youtube', 'notion'])
    .withMessage('Source type must be one of: upload, web, youtube, notion'),
  
  body('sourceUrl')
    .optional()
    .isURL()
    .withMessage('Source URL must be a valid URL'),
  
  handleValidationErrors
];

const validateSearch = [
  query('query')
    .notEmpty()
    .withMessage('Query is required')
    .isLength({ min: 1, max: 500 })
    .withMessage('Query must be between 1 and 500 characters'),
  
  query('searchType')
    .optional()
    .isIn(['vector', 'fulltext', 'hybrid'])
    .withMessage('Search type must be one of: vector, fulltext, hybrid'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  
  query('similarityThreshold')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Similarity threshold must be between 0 and 1'),
  
  handleValidationErrors
];

const validateDocumentId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Document ID must be a positive integer'),
  
  handleValidationErrors
];

const validateSessionId = [
  param('sessionId')
    .isUUID()
    .withMessage('Session ID must be a valid UUID'),
  
  handleValidationErrors
];

const validateAnalysis = [
  body('documents')
    .isArray({ min: 1 })
    .withMessage('Documents array is required and must not be empty'),
  
  body('query')
    .notEmpty()
    .withMessage('Analysis query is required')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Query must be between 1 and 1000 characters'),
  
  body('analysisType')
    .optional()
    .isIn(['general', 'technical', 'research', 'educational', 'creative'])
    .withMessage('Analysis type must be one of: general, technical, research, educational, creative'),
  
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
  validateDocumentUpload,
  validateSearch,
  validateDocumentId,
  validateSessionId,
  validateAnalysis,
  validatePagination,
  validateWorkflowType,
  sanitizeInput,
  handleValidationErrors
};