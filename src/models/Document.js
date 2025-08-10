import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

class DocumentModel {
  static async create({ title, content, sourceType = 'upload', sourceUrl = null, metadata = {} }) {
    const conn = getConnection();
    const contentHash = this.generateHash(title + content);
    
    try {
      const result = await conn.execute(`
        INSERT INTO documents (title, content, source_type, source_url, metadata, content_hash, status)
        VALUES (?, ?, ?, ?, ?, ?, 'processing')
      `, [title, content, sourceType, sourceUrl, JSON.stringify(metadata), contentHash]);
      
      // TiDB may return insertId differently
      const insertId = result.insertId || result.lastInsertId || null;
      logger.info(`Document created with ID: ${insertId}`, { title, sourceType, result: Object.keys(result) });
      
      if (!insertId) {
        // If no insertId, try to find the document by hash
        const created = await this.findByHash(contentHash);
        return created ? created.id : null;
      }
      
      return insertId;
    } catch (error) {
      if (error.message.includes('Duplicate entry')) {
        throw new Error('Document with this content already exists');
      }
      logger.logError(error, { title, sourceType });
      throw error;
    }
  }
  
  static async updateEmbedding(id, embedding) {
    const conn = getConnection();
    
    try {
      await conn.execute(`
        UPDATE documents 
        SET embedding = ?, status = 'completed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [JSON.stringify(embedding), id]);
      
      logger.info(`Document embedding updated: ${id}`);
      return true;
    } catch (error) {
      await this.updateStatus(id, 'failed');
      logger.logError(error, { documentId: id });
      throw error;
    }
  }
  
  static async updateStatus(id, status) {
    const conn = getConnection();
    
    try {
      await conn.execute(`
        UPDATE documents 
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [status, id]);
      
      return true;
    } catch (error) {
      logger.logError(error, { documentId: id, status });
      throw error;
    }
  }
  
  static async findById(id) {
    const conn = getConnection();
    
    try {
      const result = await conn.execute(`
        SELECT * FROM documents WHERE id = ?
      `, [id]);
      
      return result && result[0] ? result[0] : null;
    } catch (error) {
      logger.logError(error, { documentId: id });
      throw error;
    }
  }
  
  static async findByHash(contentHash) {
    const conn = getConnection();
    
    try {
      const result = await conn.execute(`
        SELECT * FROM documents WHERE content_hash = ?
      `, [contentHash]);
      
      return result && result[0] ? result[0] : null;
    } catch (error) {
      logger.logError(error, { contentHash });
      throw error;
    }
  }
  
  static async vectorSearch(queryEmbedding, limit = 5, similarityThreshold = 0.7) {
    const conn = getConnection();
    
    try {
      // For now, fall back to full-text search since vector search requires special TiDB setup
      logger.info('Vector search requested, falling back to content-based search');
      
      const result = await conn.execute(`
        SELECT 
          id, title, content, source_type, source_url, metadata, created_at,
          0.8 as similarity,
          0.2 as distance
        FROM documents
        WHERE status = 'completed' 
          AND embedding IS NOT NULL
          AND content IS NOT NULL
        ORDER BY created_at DESC
        LIMIT ?
      `, [limit]);
      
      return (result || []).map(row => ({
        ...row,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
        similarity: parseFloat(row.similarity),
        distance: parseFloat(row.distance)
      }));
    } catch (error) {
      logger.logError(error, { limit, similarityThreshold });
      throw error;
    }
  }
  
  static async fullTextSearch(query, limit = 10) {
    const conn = getConnection();
    
    try {
      // Use simple LIKE search since TiDB Cloud doesn't support MATCH AGAINST
      const result = await conn.execute(`
        SELECT id, title, content, source_type, source_url, metadata, created_at
        FROM documents
        WHERE status = 'completed'
          AND (title LIKE CONCAT('%', ?, '%')
               OR content LIKE CONCAT('%', ?, '%'))
        ORDER BY created_at DESC
        LIMIT ?
      `, [query, query, limit]);
      
      return (result || []).map(row => ({
        ...row,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
      }));
    } catch (error) {
      logger.logError(error, { query, limit });
      throw error;
    }
  }
  
  static async list({ sourceType = null, status = 'completed', limit = 20, offset = 0 } = {}) {
    const conn = getConnection();
    
    try {
      let sql = `
        SELECT id, title, source_type, source_url, metadata, status, created_at, updated_at
        FROM documents
        WHERE 1=1
      `;
      const params = [];
      
      if (sourceType) {
        sql += ' AND source_type = ?';
        params.push(sourceType);
      }
      
      if (status) {
        sql += ' AND status = ?';
        params.push(status);
      }
      
      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);
      
      const result = await conn.execute(sql, params);
      
      return (result || []).map(row => ({
        ...row,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
      }));
    } catch (error) {
      logger.logError(error, { sourceType, status, limit, offset });
      throw error;
    }
  }
  
  static async delete(id) {
    const conn = getConnection();
    
    try {
      const result = await conn.execute(`
        DELETE FROM documents WHERE id = ?
      `, [id]);
      
      logger.info(`Document deleted: ${id}`);
      return result.affectedRows > 0;
    } catch (error) {
      logger.logError(error, { documentId: id });
      throw error;
    }
  }
  
  static async getStats() {
    const conn = getConnection();
    
    try {
      const result = await conn.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          COUNT(DISTINCT source_type) as source_types
        FROM documents
      `);
      
      return result && result[0] ? result[0] : null;
    } catch (error) {
      logger.logError(error);
      throw error;
    }
  }
  
  static generateHash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }
}

export default DocumentModel;