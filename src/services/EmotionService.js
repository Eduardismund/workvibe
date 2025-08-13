import AWS from 'aws-sdk';
import OpenAI from 'openai';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import fs from 'fs/promises';

class EmotionService {
  constructor() {
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      this.rekognition = new AWS.Rekognition({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1'
      });
      this.awsConfigured = true;
    } else {
      this.awsConfigured = false;
    }

    this.openai = new OpenAI({
      apiKey: config.openai.apiKey
    });
  }

  /**
   * Analyze emotions using AWS Rekognition
   */
  async analyzeWithAWS(imageBuffer) {
    if (!this.awsConfigured) {
      throw new Error('AWS Rekognition not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
    }

    try {
      const params = {
        Image: {
          Bytes: imageBuffer
        },
        Attributes: ['ALL']
      };

      const result = await this.rekognition.detectFaces(params).promise();
      
      if (!result.FaceDetails || result.FaceDetails.length === 0) {
        return { error: 'No face detected in image' };
      }

      const face = result.FaceDetails[0];
      
      const emotions = {};
      face.Emotions.forEach(emotion => {
        emotions[emotion.Type.toLowerCase()] = Math.round(emotion.Confidence);
      });

      return {
        emotions,
        dominantEmotion: this.getDominantEmotion(face.Emotions),
        faceDetails: {
          ageRange: `${face.AgeRange.Low}-${face.AgeRange.High}`,
          gender: face.Gender.Value,
          smile: face.Smile.Value,
          confidence: Math.round(face.Confidence)
        }
      };
    } catch (error) {
      logger.error('AWS Rekognition error', error);
      throw new Error(`Failed to analyze emotions with AWS: ${error.message}`);
    }
  }

  /**
   * Analyze emotions using OpenAI Vision
   */
  async analyzeWithOpenAI(imageBuffer) {
    try {
      // Convert image to base64
      const base64Image = imageBuffer.toString('base64');
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze the emotions in this selfie. Return a JSON object with: emotions (object with percentages for happy, sad, angry, surprised, neutral, confused), dominantEmotion (string), and brief description (string). Be accurate and concise."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 300
      });

      const result = response.choices[0].message.content;
      
      // Parse JSON from response
      try {
        return JSON.parse(result);
      } catch {
        // If not valid JSON, return as description
        return {
          description: result,
          emotions: null,
          dominantEmotion: 'unknown'
        };
      }
    } catch (error) {
      logger.error('OpenAI Vision error', error);
      throw new Error(`Failed to analyze emotions with OpenAI: ${error.message}`);
    }
  }

  /**
   * Analyze emotions - tries AWS first, falls back to OpenAI
   */
  async analyzeEmotion(imageBuffer, preferredService = 'aws') {
    try {
      if (preferredService === 'aws' && this.awsConfigured) {
        logger.info('Using AWS Rekognition for emotion analysis');
        return {
          service: 'aws',
          ...await this.analyzeWithAWS(imageBuffer)
        };
      } else if (preferredService === 'openai' || !this.awsConfigured) {
        logger.info('Using OpenAI Vision for emotion analysis');
        return {
          service: 'openai',
          ...await this.analyzeWithOpenAI(imageBuffer)
        };
      } else {
        throw new Error('No emotion detection service available');
      }
    } catch (error) {
      logger.error('Emotion analysis failed', error);
      
      if (preferredService === 'aws' && !this.awsConfigured) {
        logger.info('Falling back to OpenAI Vision');
        return {
          service: 'openai',
          ...await this.analyzeWithOpenAI(imageBuffer)
        };
      }
      
      throw error;
    }
  }

  /**
   * Get dominant emotion from AWS emotions array
   */
  getDominantEmotion(emotions) {
    if (!emotions || emotions.length === 0) return 'neutral';
    
    let dominant = emotions[0];
    for (const emotion of emotions) {
      if (emotion.Confidence > dominant.Confidence) {
        dominant = emotion;
      }
    }
    
    return dominant.Type.toLowerCase();
  }

}

export default new EmotionService();