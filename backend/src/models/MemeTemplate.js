import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';

class MemeTemplate {
  static async upsert(memeData) {
    const conn = getConnection();
    
    try {
      const {
        id,
        name,
        url,
        boxCount,
        captions,
        useCases,
        useCasesEmbedding,
        boxGuidelines
      } = memeData;
      
      const useCasesVector = useCasesEmbedding ? `[${useCasesEmbedding.join(',')}]` : null;
      
      await conn.execute(`
        INSERT INTO meme_templates (
          id, name, url, box_count, captions,
          use_cases, use_cases_embedding, box_guidelines
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          url = VALUES(url),
          box_count = VALUES(box_count),
          captions = VALUES(captions),
          use_cases = COALESCE(VALUES(use_cases), use_cases),
          use_cases_embedding = COALESCE(VALUES(use_cases_embedding), use_cases_embedding),
          box_guidelines = COALESCE(VALUES(box_guidelines), box_guidelines),
          updated_at = CURRENT_TIMESTAMP
      `, [
        id,
        name,
        url,
        boxCount,
        captions,
        useCases || null,
        useCasesVector,
        boxGuidelines || null
      ]);
      
      logger.info('Meme template upserted', { id, name: name?.substring(0, 50) });
      return true;
    } catch (error) {
      logger.logError(error, { memeData: { id: memeData.id } });
      throw error;
    }
  }
  
  static async findSimilar(embedding, limit = 10, threshold = 0.8) {
    const conn = getConnection();
    
    try {
      const vectorString = `[${embedding.join(',')}]`;
      
      const result = await conn.execute(`
        SELECT 
          id,
          name,
          url,
          box_count,
          captions,
          use_cases,
          box_guidelines,
          (1 - VEC_COSINE_DISTANCE(use_cases_embedding, ?)) as similarity
        FROM meme_templates
        WHERE use_cases_embedding IS NOT NULL
        HAVING similarity >= ?
        ORDER BY similarity DESC
        LIMIT ?
      `, [vectorString, threshold, limit]);
      
      logger.info('Meme similarity search result', { 
        rowCount: Array.isArray(result) ? result.length : result?.rows?.length || 0,
        hasRows: Array.isArray(result) ? result.length > 0 : !!result?.rows
      });
      
      return Array.isArray(result) ? result : (result?.rows || []);
    } catch (error) {
      logger.logError(error, { context: 'FIND_SIMILAR_MEMES' });
      throw error;
    }
  }
  
  static async findByImgflipId(imgflipId) {
    const conn = getConnection();
    
    try {
      const result = await conn.execute(`
        SELECT * FROM meme_templates WHERE id = ?
      `, [imgflipId]);
      
      return Array.isArray(result) ? result[0] || null : (result?.rows?.[0] || null);
    } catch (error) {
      logger.logError(error, { imgflipId });
      throw error;
    }
  }
  

  static async getCount() {
    const conn = getConnection();
    
    try {
      const result = await conn.execute(`
        SELECT COUNT(*) as total FROM meme_templates
      `);
      
      const rows = Array.isArray(result) ? result : (result?.rows || []);
      return rows[0]?.total || 0;
    } catch (error) {
      logger.logError(error, { context: 'GET_MEME_COUNT' });
      throw error;
    }
  }
}

export default MemeTemplate;