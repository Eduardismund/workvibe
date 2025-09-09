import YouTubeService from '../services/YouTubeService.js';
import CurationService from '../services/CurationService.js';
import logger from '../utils/logger.js';
import { asyncHandler } from '../middleware/errorHandler.js';

class IngestionController {
  /**
   * Get curated feed using vector similarity
   */
  getCuratedFeed = asyncHandler(async (req, res) => {
    const { description, emotion, energy = 'medium', stress = 'medium' } = req.body;
    
    // Create context string for embedding
    const contextText = `
      User mood: ${emotion}
      Energy level: ${energy}
      Stress level: ${stress}
      Context: ${description}
    `;
    
    logger.info('Generating curated feed via vector similarity', { emotion, description });
    
    // Generate context embedding
    const contextEmbedding = await CurationService.generateEmbedding(contextText);
    
    // Find similar videos using vector search
    const similarVideos = await CurationService.findSimilarVideos(contextEmbedding, 20);
    
    res.status(200).json({
      status: 'success',
      data: {
        context: { emotion, energy, stress, description },
        recommendations: similarVideos,
        count: similarVideos.length,
        method: 'vector_similarity'
      }
    });
  });
  
  /**
   * Get database statistics
   */
  getStats = asyncHandler(async (req, res) => {
    const result = await CurationService.conn.execute(
      'SELECT COUNT(*) as total FROM video_embeddings'
    );
    
    const rows = result.rows || result;
    const total = rows[0]?.total || 0;
    
    res.status(200).json({
      status: 'success',
      data: {
        totalVideos: total,
        hasEmbeddings: true,
        ready: total > 0
      }
    });
  });
}

export default new IngestionController();