import EmotionService from '../services/EmotionService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

class EmotionController {
  /**
   * Analyze emotions from uploaded selfie
   */
  analyzeSelfie = asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Please upload an image file'
      });
    }

    try {
      const service = req.query.service || 'aws';
      
      const emotionData = await EmotionService.analyzeEmotion(
        req.file.buffer,
        service
      );

      res.status(200).json({
        emotions: emotionData.emotions,
        dominantEmotion: emotionData.dominantEmotion,
        age: emotionData.faceDetails?.ageRange,
        gender: emotionData.faceDetails?.gender,
        smile: emotionData.faceDetails?.smile,
        confidence: emotionData.faceDetails?.confidence
      });

    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to analyze emotions'
      });
    }
  });

  /**
   * Get service status
   */
  getStatus = asyncHandler(async (req, res) => {
    res.status(200).json({
      status: 'success',
      services: {
        aws: {
          available: !!process.env.AWS_ACCESS_KEY_ID,
          name: 'AWS Rekognition',
          features: ['8 emotions', 'face details', 'age/gender', 'accessories']
        },
        openai: {
          available: true,
          name: 'OpenAI Vision',
          features: ['emotion description', 'nuanced analysis', 'context understanding']
        }
      },
      usage: {
        endpoint: '/api/emotion/analyze',
        method: 'POST',
        body: 'multipart/form-data with image file',
        queryParams: {
          service: 'aws or openai (optional, default: aws)'
        }
      }
    });
  });
}

export default new EmotionController();