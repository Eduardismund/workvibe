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
      const selfie = req.file;
      
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
}

export default new MemeController();