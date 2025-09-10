import OpenAI from 'openai';
import config from '../config/index.js';
import logger from '../utils/logger.js';

class OpenAIService {
  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey
    });
  }
  
  async generateEmbedding(text, model = null) {
    const startTime = Date.now();
    
    try {
      const response = await this.client.embeddings.create({
        model: model || config.openai.embeddingModel,
        input: text,
        encoding_format: 'float'
      });
      
      const duration = Date.now() - startTime;
      logger.logApiCall('OpenAI', 'embeddings', duration, 200);
      
      return response.data[0].embedding;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logApiCall('OpenAI', 'embeddings', duration, error.status || 500);
      logger.logError(error, { text: text.substring(0, 100) });
      throw error;
    }
  }
  
  async generateCompletion(messages, options = {}) {
    return await this.chat(messages, options);
  }
  
  async chat(messages, options = {}) {
    const startTime = Date.now();
    
    const defaultOptions = {
      model: config.openai.model,
      temperature: 0.7,
      max_tokens: 2000,
      ...options
    };
    
    try {
      const response = await this.client.chat.completions.create({
        messages,
        ...defaultOptions
      });
      
      const duration = Date.now() - startTime;
      logger.logApiCall('OpenAI', 'chat/completions', duration, 200);
      
      return {
        content: response.choices[0].message.content,
        usage: response.usage,
        model: response.model,
        finishReason: response.choices[0].finish_reason
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logApiCall('OpenAI', 'chat/completions', duration, error.status || 500);
      logger.logError(error, { messageCount: messages.length });
      throw error;
    }
  }

  /**
   * Generate YouTube search tags and context description from user context
   * @param {Object} context - Context object containing emotions, calendar, description
   * @returns {Promise<Object>} Object with tags array and contextDescription string
   */
  async generateContextTags(context) {
    const { emotionData, calendarEvents, description } = context;
    
    const contextPrompt = `
      Analyze the following context and extract meaningful insights that would be further used in YouTube:
      
      1. User description of how they are feeling: ${description || 'No description provided'}
      
      2. Emotional State from Selfie:
      - All Emotions: ${JSON.stringify(emotionData?.emotions || {}, null, 2)}
      - Primary Emotion: ${emotionData?.primaryEmotion || 'Unknown'}
      
      3. Today's Calendar (${calendarEvents?.length || 0} events):
      ${calendarEvents?.map(event => `- ${event.subject}: ${event.start?.dateTime} to ${event.end?.dateTime}`).join('\n') || 'No events scheduled'}
      
      Based on this context, provide:
      1. A list of meaningful YouTube searchable tags that capture the essence of the user's current state and context
      2. A detailed contextual description that encompasses the user's expected feelings, needs, and desired content type for similarity matching against YouTube videos
      
      Format your response as JSON:
      {
        "tags": ["tag1", "tag2", ...],
        "contextDescription": "A comprehensive description of what the user is feeling and what type of content would best serve their current emotional and contextual needs. This should be detailed enough to be used for semantic similarity matching against video content."
      }
    `;
    
    try {
      const response = await this.generateCompletion([
        {
          role: 'user',
          content: contextPrompt
        }
      ], {
        model: 'gpt-4',
        temperature: 0.7,
        max_tokens: 500
      });

      const result = JSON.parse(response.content);
      
      logger.info('Generated context tags and description', {
        tagCount: result.tags?.length || 0,
        hasContextDescription: !!result.contextDescription,
        hasEmotions: !!emotionData,
        eventCount: calendarEvents?.length || 0
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to generate context tags', { error: error.message });
      return { tags: [], contextDescription: '' };
    }
  }

  /**
   * Generate embedding for YouTube video including comments
   * @param {Object} video - Video object with title, description
   * @param {Array} comments - Array of comment objects
   * @returns {Promise<Array>} Embedding vector
   */
  async generateVideoEmbedding(video, comments = []) {
    try {
      // Extract comment text
      const commentsText = comments.map(comment => 
        comment.text ||
        ''
      ).join(' ');
      
      // Combine video content with comments
      const textToEmbed = [
        video.title || '',
        video.description || '',
        commentsText
      ].filter(text => text.trim()).join(' ');
      
      if (!textToEmbed.trim()) {
        logger.warn('No text to embed for video', { videoId: video.videoId });
        return null;
      }
      
      // Generate embedding
      const embedding = await this.generateEmbedding(textToEmbed);
      
      logger.info('Generated video embedding with comments', {
        videoId: video.videoId,
        commentCount: comments.length,
        textLength: textToEmbed.length
      });
      
      return embedding;
    } catch (error) {
      logger.error('Failed to generate video embedding', {
        videoId: video.videoId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate meme use cases and text box completion guidelines
   * @param {Object} memeInfo - Meme template information
   * @returns {Promise<Object>} Object with useCases array and boxGuidelines object
   */
  async generateMemeUseCases(memeInfo) {
    const { name,  boxCount } = memeInfo;
    
    const prompt = `Analyze this popular meme template and generate abstract usage patterns and reasoning:

Meme Name: ${name}
Box Count: ${boxCount || 'Unknown'}

Generate:
1. USE CASE: describe the general scenario where this meme applies.
2. BOX GUIDELINES: General reasoning about how the ${boxCount} text boxes should relate to each other conceptually and how they should be filled.

Format as JSON:
{
  "useCases": "Abstract description of emotional/situational pattern",
  "boxGuidelines": "Description of the relationship between boxes nad how they should be filled to be logically accurate"
}

Provide only the JSON response.`;

    try {
      const response = await this.chat([
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: 0.7,
        max_tokens: 800
      });

      // Clean the response content by removing markdown code blocks
      let cleanContent = response.content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const result = JSON.parse(cleanContent);
      
      logger.info('Generated meme use cases', {
        memeName: name,
        hasUseCases: !!result.useCases,
        hasBoxGuidelines: !!result.boxGuidelines
      });
      
      return result;
    } catch (error) {
      logger.logError(error, { memeName: name });
      return {
        useCases: [],
        boxGuidelines: {}
      };
    }
  }

}

export default new OpenAIService();