import MemeService from '../services/MemeService.js';
import MemeTemplate from '../models/MemeTemplate.js';
import logger from '../utils/logger.js';

class MemeController {
  async ingestMemes(req, res) {
    try {
      const { 
        count = 50,
        delay = 1000
      } = req.body;

      logger.info('Meme ingestion started', { count, delay });

      const result = await MemeService.ingestMemes({
        count: parseInt(count),
        delay: parseInt(delay)
      });

      res.status(200).json({
        success: true,
        message: 'Meme ingestion completed',
        data: result
      });
    } catch (error) {
      logger.logError(error, { context: 'MEME_INGESTION_CONTROLLER' });
      
      res.status(500).json({
        success: false,
        message: 'Failed to ingest memes',
        error: error.message
      });
    }
  }

  async createMemeFromUserData(req, res) {
    try {
      const { description, video_id } = req.body;
      const selfie = req.file; // uploaded image file
      
      if (!selfie) {
        return res.status(400).json({
          success: false,
          message: 'Selfie image is required'
        });
      }

      if (!description) {
        return res.status(400).json({
          success: false,
          message: 'Description is required'
        });
      }

      logger.info('Creating meme from user data', { 
        hasImage: !!selfie, 
        description: description?.substring(0, 50),
        video_id
      });

      const result = await MemeService.createMemeFromUserData({
        selfie: selfie.buffer,
        description,
        video_id
      });

      res.status(200).json({
        success: true,
        message: 'Meme created successfully',
        data: result
      });
    } catch (error) {
      logger.logError(error, { context: 'CREATE_MEME_FROM_USER_DATA_CONTROLLER' });

      res.status(500).json({
        success: false,
        message: 'Failed to create meme from user data',
        error: error.message
      });
    }
  }


  async getMemes(req, res) {
    try {
      const { limit = 50 } = req.query;
      
      const memes = await MemeTemplate.getAll(parseInt(limit));
      
      res.status(200).json({
        success: true,
        data: memes,
        count: memes.length
      });
    } catch (error) {
      logger.logError(error, { context: 'GET_MEMES_CONTROLLER' });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve memes',
        error: error.message
      });
    }
  }

  async getMemeById(req, res) {
    try {
      const { id } = req.params;
      
      const meme = await MemeTemplate.findById(id);
      
      if (!meme) {
        return res.status(404).json({
          success: false,
          message: 'Meme not found'
        });
      }
      
      res.status(200).json({
        success: true,
        data: meme
      });
    } catch (error) {
      logger.logError(error, { context: 'GET_MEME_BY_ID_CONTROLLER', id: req.params.id });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve meme',
        error: error.message
      });
    }
  }

  async searchMemesByName(req, res) {
    try {
      const { name, limit = 20 } = req.query;
      
      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Name parameter is required'
        });
      }
      
      const memes = await MemeTemplate.findByName(name, parseInt(limit));
      
      res.status(200).json({
        success: true,
        data: memes,
        count: memes.length
      });
    } catch (error) {
      logger.logError(error, { context: 'SEARCH_MEMES_BY_NAME_CONTROLLER', name: req.query.name });
      
      res.status(500).json({
        success: false,
        message: 'Failed to search memes',
        error: error.message
      });
    }
  }

  async findSimilarMemes(req, res) {
    try {
      const { query, limit = 10, threshold = 0.8 } = req.body;
      
      if (!query) {
        return res.status(400).json({
          success: false,
          message: 'Query parameter is required'
        });
      }
      
      const similarMemes = await MemeService.findSimilarMemes(
        query, 
        parseInt(limit), 
        parseFloat(threshold)
      );
      
      res.status(200).json({
        success: true,
        data: similarMemes,
        count: similarMemes.length,
        query
      });
    } catch (error) {
      logger.logError(error, { context: 'FIND_SIMILAR_MEMES_CONTROLLER', query: req.body.query });
      
      res.status(500).json({
        success: false,
        message: 'Failed to find similar memes',
        error: error.message
      });
    }
  }

  async getMemesWithoutUseCases(req, res) {
    try {
      const { limit = 50 } = req.query;
      
      const memes = await MemeTemplate.getMemesWithoutUseCases(parseInt(limit));
      
      res.status(200).json({
        success: true,
        data: memes,
        count: memes.length
      });
    } catch (error) {
      logger.logError(error, { context: 'GET_MEMES_WITHOUT_USE_CASES_CONTROLLER' });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve memes without use cases',
        error: error.message
      });
    }
  }

  async getMemesWithoutEmbedding(req, res) {
    try {
      const { limit = 50 } = req.query;
      
      const memes = await MemeTemplate.getMemesWithoutEmbedding(parseInt(limit));
      
      res.status(200).json({
        success: true,
        data: memes,
        count: memes.length
      });
    } catch (error) {
      logger.logError(error, { context: 'GET_MEMES_WITHOUT_EMBEDDING_CONTROLLER' });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve memes without embedding',
        error: error.message
      });
    }
  }

  async updateMemeUseCases(req, res) {
    try {
      const { id } = req.params;
      const { useCases, boxGuidelines } = req.body;
      
      if (!useCases) {
        return res.status(400).json({
          success: false,
          message: 'Use cases is required'
        });
      }
      
      const embedding = await MemeService.generateUseCasesEmbedding(useCases);
      await MemeTemplate.updateUseCases(id, useCases, embedding, boxGuidelines);
      
      res.status(200).json({
        success: true,
        message: 'Meme use cases updated successfully'
      });
    } catch (error) {
      logger.logError(error, { context: 'UPDATE_MEME_USE_CASES_CONTROLLER', id: req.params.id });
      
      res.status(500).json({
        success: false,
        message: 'Failed to update meme use cases',
        error: error.message
      });
    }
  }
}

export default new MemeController();