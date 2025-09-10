import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import OpenAIService from './OpenAIService.js';
import MemeTemplate from '../models/MemeTemplate.js';
import EmotionService from './EmotionService.js';
import YouTubeService from './YouTubeService.js';

class MemeService {
  constructor() {
    this.imgflipApiUrl = 'https://api.imgflip.com/get_memes';
    this.imgflipCaptionUrl = 'https://api.imgflip.com/caption_image';
  }

  async fetchMemesFromImgflip() {
    try {
      logger.info('Fetching memes from Imgflip API');
      
      const response = await fetch(this.imgflipApiUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Imgflip API request failed');
      }
      
      const memes = data.data.memes.map(meme => ({
        id: meme.id,
        name: meme.name,
        url: meme.url,
        boxCount: meme.box_count,
        captions: meme.captions,
        useCases: null,
        useCasesEmbedding: null,
        boxGuidelines: null
      }));
      
      logger.info(`Fetched ${memes.length} memes from Imgflip`);
      return memes;
    } catch (error) {
      logger.logError(error, { context: 'FETCH_MEMES_FROM_IMGFLIP' });
      throw error;
    }
  }

  async generateUseCasesEmbedding(useCases) {
    try {
      const useCasesText = typeof useCases === 'string' ? useCases : useCases.join(' ');
      const embedding = await OpenAIService.generateEmbedding(useCasesText);
      logger.info('Generated embedding for use cases', { embeddingLength: embedding?.length });
      return embedding;
    } catch (error) {
      logger.logError(error, { context: 'GENERATE_USE_CASES_EMBEDDING' });
      throw error;
    }
  }

  async processMemeWithUseCases(meme) {
    try {
      const useCasesData = await OpenAIService.generateMemeUseCases({
        name: meme.name,
        url: meme.url,
        boxCount: meme.boxCount,
        captions: meme.captions
      });

      if (useCasesData.useCases) {
        meme.useCases = useCasesData.useCases;
        meme.boxGuidelines = useCasesData.boxGuidelines;
        meme.useCasesEmbedding = await this.generateUseCasesEmbedding(useCasesData.useCases);
      }

      return meme;
    } catch (error) {
      logger.logError(error, { context: 'PROCESS_MEME_WITH_USE_CASES', memeId: meme.id });
      meme.useCases = null;
      meme.useCasesEmbedding = null;
      meme.boxGuidelines = null;
      return meme;
    }
  }

  async ingestMemes(options = {}) {
    const { 
      count = 50,
      delay = 1000
    } = options;

    try {
      // Get current count of memes in database
      const currentCount = await MemeTemplate.getCount();
      logger.info(`Database currently has ${currentCount} memes`);

      // Fetch all memes from Imgflip
      const allMemes = await this.fetchMemesFromImgflip();
      logger.info(`Fetched ${allMemes.length} memes from Imgflip`);

      // Start from the next available position (n+1)
      const startIndex = currentCount;
      const endIndex = Math.min(startIndex + count, allMemes.length);
      const memesToProcess = allMemes.slice(startIndex, endIndex);

      if (memesToProcess.length === 0) {
        logger.info('No new memes to process');
        return {
          total: 0,
          successful: 0,
          failed: 0,
          message: 'No new memes to process',
          results: []
        };
      }

      logger.info(`Starting meme ingestion of ${memesToProcess.length} memes starting from position ${startIndex + 1}`, { 
        count,
        delay,
        startIndex: startIndex + 1,
        endIndex
      });

      const results = [];

      for (let i = 0; i < memesToProcess.length; i++) {
        const meme = memesToProcess[i];
        const globalIndex = startIndex + i + 1;
        
        try {
          logger.info(`Processing meme ${i + 1}/${memesToProcess.length} (global: ${globalIndex}): ${meme.name}`);

          const existingMeme = await MemeTemplate.findByImgflipId(meme.id);
          if (existingMeme) {
            logger.info('Meme already exists, skipping', { id: meme.id });
            results.push({ id: meme.id, success: true, status: 'skipped' });
            continue;
          }

          await this.processMemeWithUseCases(meme);
          await MemeTemplate.upsert(meme);
          results.push({ id: meme.id, success: true, status: 'ingested' });

          // Add delay between each meme (except the last one)
          if (i < memesToProcess.length - 1 && delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }

        } catch (error) {
          logger.warn('Failed to process meme', { 
            memeId: meme.id, 
            error: error.message 
          });
          results.push({ id: meme.id, success: false, error: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      const newCount = await MemeTemplate.getCount();

      logger.info('Meme ingestion completed', {
        total: results.length,
        successful: successCount,
        failed: failCount,
        startedFrom: startIndex + 1,
        databaseCountBefore: currentCount,
        databaseCountAfter: newCount
      });

      return {
        total: results.length,
        successful: successCount,
        failed: failCount,
        startedFrom: startIndex + 1,
        databaseCountBefore: currentCount,
        databaseCountAfter: newCount,
        results
      };
    } catch (error) {
      logger.logError(error, { context: 'INGEST_MEMES' });
      throw error;
    }
  }


  async findSimilarMemes(query, limit = 10, threshold = 0.8) {
    try {
      const queryEmbedding = await OpenAIService.generateEmbedding(query);
      const similarMemes = await MemeTemplate.findSimilar(queryEmbedding, limit, threshold);
      
      logger.info('Found similar memes', { 
        query, 
        resultCount: similarMemes.length 
      });
      
      return similarMemes;
    } catch (error) {
      logger.logError(error, { context: 'FIND_SIMILAR_MEMES', query });
      throw error;
    }
  }

  async createMemeFromUserData({ selfie, description, video_id }) {
    try {
      logger.info('Starting meme creation workflow', { 
        hasImage: !!selfie, 
        hasDescription: !!description,
        hasVideoId: !!video_id
      });

      // Step 1: Analyze emotion from selfie
      logger.info('Step 1: Analyzing emotions from selfie');
      const emotionData = await EmotionService.analyzeWithAWS(selfie);
      
      if (emotionData.error) {
        throw new Error(`Emotion analysis failed: ${emotionData.error}`);
      }

      // Step 2: Get video data if video_id provided
      let videoData = null;
      if (video_id) {
        logger.info('Step 2: Fetching YouTube video data', { video_id });
        try {
          videoData = await YouTubeService.getVideoMetadata(video_id);
        } catch (error) {
          logger.warn('Failed to fetch video data', { video_id, error: error.message });
        }
      }

      // Step 3: Generate context using AI
      logger.info('Step 3: Generating context from user data');
      const context = await this.generateUserContext({
        emotions: emotionData.emotions,
        primaryEmotion: emotionData.primaryEmotion,
        description,
        videoData
      });

      // Step 4: Find best matching meme template
      logger.info('Step 4: Finding best meme template');
      const contextEmbedding = await OpenAIService.generateEmbedding(context);
      const similarMemes = await MemeTemplate.findSimilar(contextEmbedding, 1, 0.5);
      
      if (similarMemes.length === 0) {
        throw new Error('No suitable meme template found for the given context');
      }

      const bestMeme = similarMemes[0];
      logger.info('Found best meme template', { 
        memeName: bestMeme.name, 
        similarity: bestMeme.similarity 
      });

      // Step 5: Generate meme text using AI
      logger.info('Step 5: Generating meme text');
      const memeText = await this.generateMemeText({
        memeTemplate: bestMeme,
        context,
        emotions: emotionData,
        description,
        videoData
      });

      // Step 6: Create the actual meme image with text
      logger.info('Step 6: Creating meme image');
      const memeImage = await this.createMemeImage(bestMeme.id, memeText.texts);

      return {
        memeTemplate: {
          id: bestMeme.id,
          name: bestMeme.name,
          originalUrl: bestMeme.url,
          box_count: bestMeme.box_count,
          similarity: bestMeme.similarity
        },
        createdMeme: {
          imageUrl: memeImage.imageUrl,
          pageUrl: memeImage.pageUrl
        },
        context,
        emotionAnalysis: {
          primaryEmotion: emotionData.primaryEmotion,
          emotions: emotionData.emotions
        },
        memeText,
        videoData: videoData ? {
          title: videoData.title,
          description: videoData.description?.substring(0, 200) + '...'
        } : null
      };

    } catch (error) {
      logger.logError(error, { context: 'CREATE_MEME_FROM_USER_DATA' });
      throw error;
    }
  }

  async generateUserContext({ emotions, primaryEmotion, description, videoData }) {
    try {
      const prompt = `Analyze this user context and create an abstract description that captures their current emotional and situational state:

User Description: ${description}

Emotional State:
- Primary Emotion: ${primaryEmotion || 'Unknown'}
- All Emotions: ${emotions ? Object.entries(emotions).map(([emotion, confidence]) => `${emotion}: ${confidence.toFixed(2)}`).join(', ') : 'None detected'}

${videoData ? `
Video Context:
- Title: ${videoData.title || 'No title'}
- Description: ${videoData.description?.substring(0, 300) || 'No description'}
` : ''}

Create a contextual description that captures:
- The underlying emotional pattern or contradiction
- Universal experiences this represents
- The type of meme-worthy situation this describes
- Abstract themes that would match with meme templates

Provide a concise but comprehensive description of the user's current state and what kind of meme would best represent their situation.`;

      const response = await OpenAIService.chat([
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: 0.7,
        max_tokens: 300
      });

      return response.content;
    } catch (error) {
      logger.logError(error, { context: 'GENERATE_USER_CONTEXT' });
      throw error;
    }
  }

  async generateMemeText({ memeTemplate, context, emotions, description, videoData }) {
    try {
      const prompt = `Generate specific text for each box of this meme template based on the user's context:

Meme Template: ${memeTemplate.name}
Number of text boxes: ${memeTemplate.box_count}
Template Guidelines: ${memeTemplate.box_guidelines || 'No specific guidelines'}

User Context: ${context}
User Description: ${description}
Primary Emotion: ${emotions.primaryEmotion || 'Unknown'}

${videoData ? `Video Context: ${videoData.title}` : ''}

Generate text for each of the ${memeTemplate.box_count} boxes that:
1. Follows the meme template's typical usage pattern
2. Reflects the user's emotional state and situation
3. Creates humor through contrast, irony, or relatability
4. Is concise and meme-appropriate (short, punchy text)

Format as JSON:
{
  "texts": ["Text for box 1", "Text for box 2", ...],
  "explanation": "Brief explanation of why this text fits the user's situation"
}

Provide only the JSON response.`;

      const response = await OpenAIService.chat([
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: 0.8,
        max_tokens: 400
      });

      // Clean response content
      let cleanContent = response.content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const result = JSON.parse(cleanContent);
      
      return result;
    } catch (error) {
      logger.logError(error, { context: 'GENERATE_MEME_TEXT' });
      throw error;
    }
  }

  async createMemeImage(templateId, texts) {
    try {
      if (!process.env.IMGFLIP_USERNAME || !process.env.IMGFLIP_PASSWORD) {
        throw new Error('Imgflip credentials not configured. Set IMGFLIP_USERNAME and IMGFLIP_PASSWORD');
      }

      logger.info('Creating meme image with Imgflip API', { 
        templateId, 
        textCount: texts.length 
      });

      const formData = new URLSearchParams();
      formData.append('template_id', templateId);
      formData.append('username', process.env.IMGFLIP_USERNAME);
      formData.append('password', process.env.IMGFLIP_PASSWORD);

      // Use boxes parameter for multiple text boxes (required for 3+ boxes)
      texts.forEach((text, index) => {
        formData.append(`boxes[${index}][text]`, text);
      });

      const response = await fetch(this.imgflipCaptionUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(`Imgflip API error: ${data.error_message}`);
      }

      logger.info('Meme image created successfully', { 
        memeUrl: data.data.url,
        pageUrl: data.data.page_url
      });

      return {
        imageUrl: data.data.url,
        pageUrl: data.data.page_url
      };
    } catch (error) {
      logger.logError(error, { context: 'CREATE_MEME_IMAGE' });
      throw error;
    }
  }
}

export default new MemeService();