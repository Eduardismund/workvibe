import DocumentModel from '../models/Document.js';
import OpenAIService from './OpenAIService.js';
import logger from '../utils/logger.js';
import fs from 'fs/promises';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import crypto from 'crypto';

class DocumentService {
  async processDocument(filePath, title, sourceType = 'upload', sourceUrl = null, additionalMetadata = {}) {
    const startTime = Date.now();
    let documentId = null;
    
    try {
      logger.info('Starting document processing', { filePath, title, sourceType });
      
      // Step 1: Extract content from file
      const content = await this.extractContent(filePath, sourceType);
      
      // Step 2: Generate metadata
      const metadata = await this.generateMetadata(content, additionalMetadata);
      
      // Step 3: Create document record
      documentId = await DocumentModel.create({
        title,
        content,
        sourceType,
        sourceUrl,
        metadata
      });
      
      // Step 4: Generate and store embedding (async)
      await this.processEmbedding(documentId, content);
      
      const processingTime = Date.now() - startTime;
      logger.info(`Document processing completed: ${documentId}`, {
        title,
        contentLength: content.length,
        processingTime
      });
      
      return await DocumentModel.findById(documentId);
      
    } catch (error) {
      if (documentId) {
        await DocumentModel.updateStatus(documentId, 'failed').catch(() => {});
      }
      
      logger.logError(error, { filePath, title, sourceType });
      throw error;
    } finally {
      // Clean up uploaded file
      if (filePath && sourceType === 'upload') {
        await fs.unlink(filePath).catch(() => {});
      }
    }
  }
  
  async extractContent(filePath, sourceType) {
    try {
      switch (sourceType) {
        case 'upload':
          return await this.extractFromFile(filePath);
        case 'web':
          return await this.extractFromUrl(filePath); // filePath is URL in this case
        case 'youtube':
          return await this.extractFromYoutube(filePath); // filePath is YouTube URL
        default:
          throw new Error(`Unsupported source type: ${sourceType}`);
      }
    } catch (error) {
      logger.logError(error, { filePath, sourceType });
      throw new Error(`Failed to extract content: ${error.message}`);
    }
  }
  
  async extractFromFile(filePath) {
    const dataBuffer = await fs.readFile(filePath);
    const fileExtension = filePath.toLowerCase().split('.').pop();
    
    switch (fileExtension) {
      case 'pdf':
        const pdfData = await pdfParse(dataBuffer);
        return pdfData.text;
      
      case 'txt':
      case 'md':
      case 'markdown':
        return dataBuffer.toString('utf-8');
      
      case 'json':
        const jsonData = JSON.parse(dataBuffer.toString('utf-8'));
        return JSON.stringify(jsonData, null, 2);
      
      default:
        // Try to read as text
        return dataBuffer.toString('utf-8');
    }
  }
  
  async extractFromUrl(url) {
    // This would integrate with web scraping
    // For now, return placeholder
    return `Web content from: ${url}`;
  }
  
  async extractFromYoutube(url) {
    // This would integrate with YouTube API for transcripts
    // For now, return placeholder
    return `YouTube content from: ${url}`;
  }
  
  async generateMetadata(content, additionalMetadata = {}) {
    try {
      const [tags, keyPhrases] = await Promise.all([
        OpenAIService.generateTags(content, 8),
        OpenAIService.extractKeyPhrases(content, 10)
      ]);
      
      return {
        wordCount: content.split(/\s+/).length,
        characterCount: content.length,
        tags,
        keyPhrases,
        extractedAt: new Date().toISOString(),
        ...additionalMetadata
      };
    } catch (error) {
      logger.logError(error, { contentLength: content.length });
      return {
        wordCount: content.split(/\s+/).length,
        characterCount: content.length,
        extractedAt: new Date().toISOString(),
        ...additionalMetadata
      };
    }
  }
  
  async processEmbedding(documentId, content) {
    try {
      // Truncate content if too long for embedding
      const maxLength = 8000; // OpenAI embedding limit
      const truncatedContent = content.length > maxLength 
        ? content.substring(0, maxLength)
        : content;
      
      const embedding = await OpenAIService.generateEmbedding(truncatedContent);
      await DocumentModel.updateEmbedding(documentId, embedding);
      
      logger.info(`Embedding generated for document: ${documentId}`);
    } catch (error) {
      logger.logError(error, { documentId });
      await DocumentModel.updateStatus(documentId, 'failed');
      throw error;
    }
  }
  
  async searchDocuments(query, searchType = 'vector', options = {}) {
    const {
      limit = 10,
      similarityThreshold = 0.7,
      sourceType = null,
      includeContent = true
    } = options;
    
    const startTime = Date.now();
    
    try {
      let results = [];
      
      switch (searchType) {
        case 'vector':
          const queryEmbedding = await OpenAIService.generateEmbedding(query);
          results = await DocumentModel.vectorSearch(queryEmbedding, limit, similarityThreshold);
          break;
          
        case 'fulltext':
          results = await DocumentModel.fullTextSearch(query, limit);
          break;
          
        case 'hybrid':
          // Combine vector and full-text search
          const [vectorResults, textResults] = await Promise.all([
            this.searchDocuments(query, 'vector', { ...options, limit: Math.ceil(limit / 2) }),
            this.searchDocuments(query, 'fulltext', { ...options, limit: Math.ceil(limit / 2) })
          ]);
          
          results = this.mergeSearchResults(vectorResults.documents, textResults.documents, limit);
          break;
          
        default:
          throw new Error(`Unsupported search type: ${searchType}`);
      }
      
      // Filter by source type if specified
      if (sourceType) {
        results = results.filter(doc => doc.source_type === sourceType);
      }
      
      // Remove content if not needed to reduce response size
      if (!includeContent) {
        results = results.map(doc => ({
          ...doc,
          content: doc.content ? doc.content.substring(0, 200) + '...' : ''
        }));
      }
      
      const searchTime = Date.now() - startTime;
      logger.info(`Document search completed`, {
        query: query.substring(0, 50),
        searchType,
        resultCount: results.length,
        searchTime
      });
      
      return {
        query,
        searchType,
        documents: results,
        totalResults: results.length,
        searchTime
      };
      
    } catch (error) {
      logger.logError(error, { query, searchType });
      throw error;
    }
  }
  
  mergeSearchResults(vectorResults, textResults, limit) {
    const merged = new Map();
    
    // Add vector results with higher weight
    vectorResults.forEach((doc, index) => {
      merged.set(doc.id, {
        ...doc,
        score: (vectorResults.length - index) * 2 + (doc.similarity || 0)
      });
    });
    
    // Add text results with lower weight
    textResults.forEach((doc, index) => {
      if (merged.has(doc.id)) {
        merged.get(doc.id).score += textResults.length - index;
      } else {
        merged.set(doc.id, {
          ...doc,
          score: textResults.length - index
        });
      }
    });
    
    return Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score, ...doc }) => doc);
  }
  
  async analyzeDocuments(documents, query, analysisType = 'general') {
    try {
      const result = await OpenAIService.summarizeDocuments(documents, query, {
        temperature: 0.3
      });
      
      logger.info('Document analysis completed', {
        documentCount: documents.length,
        analysisType,
        query: query.substring(0, 50)
      });
      
      return {
        analysis: result.content,
        query,
        analysisType,
        documentCount: documents.length,
        usage: result.usage,
        generatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      logger.logError(error, { documentCount: documents.length, analysisType });
      throw error;
    }
  }
  
  async getDocumentById(id) {
    try {
      return await DocumentModel.findById(id);
    } catch (error) {
      logger.logError(error, { documentId: id });
      throw error;
    }
  }
  
  async listDocuments(options = {}) {
    try {
      return await DocumentModel.list(options);
    } catch (error) {
      logger.logError(error, options);
      throw error;
    }
  }
  
  async deleteDocument(id) {
    try {
      const result = await DocumentModel.delete(id);
      
      if (result) {
        logger.info(`Document deleted: ${id}`);
      }
      
      return result;
    } catch (error) {
      logger.logError(error, { documentId: id });
      throw error;
    }
  }
  
  async getStats() {
    try {
      return await DocumentModel.getStats();
    } catch (error) {
      logger.logError(error);
      throw error;
    }
  }
}

export default new DocumentService();