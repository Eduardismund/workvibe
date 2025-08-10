import DocumentService from '../services/DocumentService.js';
import DirectAgentService from '../services/DirectAgentService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

class DocumentController {
  // Upload and process document
  uploadDocument = asyncHandler(async (req, res) => {
    const { title, sourceType = 'upload', sourceUrl } = req.body;
    const file = req.file;
    
    if (!file && sourceType === 'upload') {
      return res.status(400).json({
        status: 'error',
        message: 'No file uploaded'
      });
    }
    
    logger.info('Document upload request', { 
      title, 
      sourceType, 
      filename: file?.originalname 
    });
    
    const document = await DocumentService.processDocument(
      file?.path,
      title,
      sourceType,
      sourceUrl,
      {
        originalName: file?.originalname,
        mimetype: file?.mimetype,
        size: file?.size
      }
    );
    
    res.status(201).json({
      status: 'success',
      data: {
        document: {
          id: document.id,
          title: document.title,
          sourceType: document.source_type,
          status: document.status,
          createdAt: document.created_at
        }
      }
    });
  });
  
  // Process document with full agent workflow
  processWithAgent = asyncHandler(async (req, res) => {
    const { title, content, query, analysisType = 'general' } = req.body;
    const file = req.file;
    
    logger.info('Agent workflow request', { title, analysisType });
    
    // Extract content if file provided
    let documentContent = content;
    if (file) {
      documentContent = await DocumentService.extractContent(file.path, 'upload');
    }
    
    // Execute document analysis workflow
    const result = await DirectAgentService.executeDocumentAnalysisWorkflow({
      title,
      content: documentContent,
      query: query || `Analyze and summarize: ${title}`,
      analysisType
    }, {
      sourceType: 'upload',
      metadata: {
        originalName: file?.originalname,
        processedViaAgent: true
      }
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        workflow: result
      }
    });
  });
  
  // Search documents
  searchDocuments = asyncHandler(async (req, res) => {
    const { 
      query, 
      searchType = 'vector', 
      limit = 10, 
      similarityThreshold = 0.7,
      sourceType,
      includeContent = false
    } = req.query;
    
    logger.info('Document search request', { query, searchType, limit });
    
    const results = await DocumentService.searchDocuments(query, searchType, {
      limit: parseInt(limit),
      similarityThreshold: parseFloat(similarityThreshold),
      sourceType,
      includeContent: includeContent === 'true'
    });
    
    res.status(200).json({
      status: 'success',
      data: results
    });
  });
  
  // Analyze documents with AI
  analyzeDocuments = asyncHandler(async (req, res) => {
    const { documents, query, analysisType = 'general' } = req.body;
    
    logger.info('Document analysis request', { 
      documentCount: documents.length, 
      analysisType 
    });
    
    const analysis = await DocumentService.analyzeDocuments(
      documents,
      query,
      analysisType
    );
    
    res.status(200).json({
      status: 'success',
      data: analysis
    });
  });
  
  // Get document by ID
  getDocument = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const document = await DocumentService.getDocumentById(parseInt(id));
    
    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: { document }
    });
  });
  
  // List documents
  listDocuments = asyncHandler(async (req, res) => {
    const { 
      sourceType, 
      status = 'completed', 
      limit = 20, 
      offset = 0,
      page
    } = req.query;
    
    const actualOffset = page ? (parseInt(page) - 1) * parseInt(limit) : parseInt(offset);
    
    const documents = await DocumentService.listDocuments({
      sourceType,
      status,
      limit: parseInt(limit),
      offset: actualOffset
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        documents,
        pagination: {
          limit: parseInt(limit),
          offset: actualOffset,
          page: page ? parseInt(page) : Math.floor(actualOffset / parseInt(limit)) + 1
        }
      }
    });
  });
  
  // Delete document
  deleteDocument = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const deleted = await DocumentService.deleteDocument(parseInt(id));
    
    if (!deleted) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Document deleted successfully'
    });
  });
  
  // Get document statistics
  getStats = asyncHandler(async (req, res) => {
    const stats = await DocumentService.getStats();
    
    res.status(200).json({
      status: 'success',
      data: { stats }
    });
  });
}

export default new DocumentController();