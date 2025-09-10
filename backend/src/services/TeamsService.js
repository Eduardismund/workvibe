import { ConfidentialClientApplication } from '@azure/msal-node';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { getConnection } from '../config/database.js';
import 'isomorphic-fetch';

class TeamsService {
  constructor() {
    this.clientConfig = config.external.microsoft;
    this._isConfigured = !!(this.clientConfig.clientId && this.clientConfig.clientSecret && this.clientConfig.tenantId);
    
    if (this._isConfigured) {
      this.msalInstance = new ConfidentialClientApplication({
        auth: {
          clientId: this.clientConfig.clientId,
          clientSecret: this.clientConfig.clientSecret,
          authority: `https://login.microsoftonline.com/${this.clientConfig.tenantId}`
        }
      });
    }
  }
  
  /**
   * Get application access token for Graph API
   */
  async getAccessToken() {
    if (!this._isConfigured) {
      throw new Error('Microsoft Graph is not configured');
    }
    
    try {
      const response = await this.msalInstance.acquireTokenByClientCredential({
        scopes: ['https://graph.microsoft.com/.default'],
      });
      
      return response.accessToken;
    } catch (error) {
      throw new Error('Failed to acquire access token for Microsoft Graph');
    }
  }
  
  /**
   * Make API call to Microsoft Graph
   */
  async makeGraphApiCall(endpoint, userToken = null, method = 'GET', body = null) {
    const accessToken = userToken || await this.getAccessToken();
    
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, options);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Graph API error: ${response.status} - ${error}`);
    }
    
    return response.json();
  }
  
  /**
   * Get user's calendar events (with caching)
   */
  async getUserCalendarEvents(userPrincipalName, options = {}) {
    try {
      // Get user email for cache lookup - use provided email or fallback to userPrincipalName
      const userEmail = options.userEmail || userPrincipalName || 'me';
      
      // Check cache first
      if (!options.forceRefresh) {
        const cachedEvents = await this.getCachedMeetings(userEmail, options);
        if (cachedEvents && cachedEvents.length > 0) {
          logger.info('Returning cached meetings', { userEmail, count: cachedEvents.length });
          return cachedEvents;
        }
      }

      const startDateTime = options.startTime || new Date().toISOString();
      const endDateTime = options.endTime || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const params = new URLSearchParams({
        '$filter': `start/dateTime ge '${startDateTime}' and end/dateTime le '${endDateTime}'`,
        '$orderby': 'start/dateTime',
        '$top': options.maxResults || 50,
        '$select': 'id,subject,start,end,bodyPreview'
      });
      
      const endpoint = options.userToken
        ? `/me/calendar/events?${params.toString()}`
        : `/users/${userPrincipalName}/calendar/events?${params.toString()}`;
      
      logger.info('Calling Microsoft Graph API', { endpoint });
        
      const result = await this.makeGraphApiCall(endpoint, options.userToken);

      const formattedEvents = this.formatCalendarEvents(result.value || []);
      
      // Cache the results
      await this.cacheMeetings(userEmail, formattedEvents);
      
      return formattedEvents;
    } catch (error) {
      logger.error('Error getting calendar events', error);
      throw new Error(`Failed to get calendar events: ${error.message}`);
    }
  }
  
  /**
   * Format calendar events to simple structure
   */
  formatCalendarEvents(events) {
    return events.map(event => ({
      id: event.id,
      subject: event.subject,
      start: event.start?.dateTime,
      end: event.end?.dateTime,
      duration: this.calculateDuration(event.start?.dateTime, event.end?.dateTime),
      bodyPreview: event.bodyPreview || ''
    }));
  }


  /**
   * Send a message to a Teams meeting chat
   */
  async sendMeetingMessage(meetingId, message, userToken = null) {
    try {
      logger.info('Sending message to Teams meeting', { meetingId, messageLength: message.length });
      
      // For meeting chats, we need to use the onlineMeeting chat thread
      // First, get the meeting details to find the chat thread
      const meetingEndpoint = `/me/onlineMeetings/${meetingId}`;
      const meeting = await this.makeGraphApiCall(meetingEndpoint, userToken);
      
      if (!meeting.chatInfo?.threadId) {
        throw new Error('Meeting chat thread not found');
      }
      
      // Send message to the chat thread
      const messagePayload = {
        body: {
          contentType: 'text',
          content: message
        }
      };
      
      const chatEndpoint = `/chats/${meeting.chatInfo.threadId}/messages`;
      const result = await this.makeGraphApiCall(chatEndpoint, userToken, 'POST', messagePayload);
      
      logger.info('Message sent successfully', { 
        meetingId, 
        messageId: result.id,
        chatThreadId: meeting.chatInfo.threadId 
      });
      
      return {
        success: true,
        messageId: result.id,
        chatThreadId: meeting.chatInfo.threadId,
        sentAt: result.createdDateTime
      };
      
    } catch (error) {
      logger.error('Error sending meeting message', { meetingId, error: error.message });
      throw new Error(`Failed to send meeting message: ${error.message}`);
    }
  }

  /**
   * Send a message to a calendar event's associated Teams meeting
   */
  async sendEventMessage(eventId, message, userToken = null) {
    try {

      const eventEndpoint = `/me/calendar/events/${eventId}`;
      const event = await this.makeGraphApiCall(eventEndpoint, userToken);
      
      if (!event.isOnlineMeeting) {
        throw new Error('Event is not a Teams meeting');
      }
      
      // Extract thread ID from meeting URL
      const meetingUrl = event.onlineMeetingUrl || event.onlineMeeting?.joinUrl;
      if (!meetingUrl) {
        throw new Error('No Teams meeting URL found');
      }
      
      // Extract thread ID from the URL pattern
      const threadIdMatch = meetingUrl.match(/meetup-join\/([^\/\?]+)/);
      if (!threadIdMatch) {
        throw new Error('Could not extract thread ID from meeting URL');
      }
      
      const threadId = decodeURIComponent(threadIdMatch[1]);
      logger.info('Extracted thread ID from meeting URL', { threadId });
      
      // Send message directly to the chat thread
      const messagePayload = {
        body: {
          contentType: 'text',
          content: message
        }
      };
      
      const chatEndpoint = `/chats/${threadId}/messages`;
      const result = await this.makeGraphApiCall(chatEndpoint, userToken, 'POST', messagePayload);
      
      return {
        success: true,
        messageId: result.id,
        chatThreadId: threadId,
        sentAt: result.createdDateTime
      };
      
    } catch (error) {
      logger.error('Error sending event message', { eventId, error: error.message });
      throw new Error(`Failed to send event message: ${error.message}`);
    }
  }



  /**
   * Calculate event duration in minutes
   */
  calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    return Math.round((end - start) / (1000 * 60));
  }

  /**
   * Cache meetings in TiDB (add 6 hours to compensate for timezone difference)
   */
  async cacheMeetings(userEmail, meetings) {
    try {
      const conn = getConnection();
      
      for (const meeting of meetings) {
        const startTime = meeting.start ? new Date(new Date(meeting.start).getTime() + (6 * 60 * 60 * 1000)) : null;
        const endTime = meeting.end ? new Date(new Date(meeting.end).getTime() + (6 * 60 * 60 * 1000)) : null;
        
        await conn.execute(`
          INSERT INTO teams_meetings (
            id, user_email, subject, start_time, end_time, duration_minutes, body_preview
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            subject = VALUES(subject),
            start_time = VALUES(start_time),
            end_time = VALUES(end_time),
            duration_minutes = VALUES(duration_minutes),
            body_preview = VALUES(body_preview),
            updated_at = NOW()
        `, [
          meeting.id,
          userEmail,
          meeting.subject,
          startTime,
          endTime,
          meeting.duration,
          meeting.bodyPreview || ''
        ]);
      }
    } catch (error) {
      logger.error('Failed to cache meetings', { userEmail, error: error.message });
    }
  }

  /**
   * Get cached meetings from TiDB (with timezone handling)
   */
  async getCachedMeetings(userEmail) {
    try {
      const conn = getConnection();

      const now = new Date();
      const nowAdjusted = new Date(now.getTime() + (3 * 60 * 60 * 1000));
      
      const next12Hours = new Date(nowAdjusted.getTime() + (12 * 60 * 60 * 1000));

      const result = await conn.execute(`
        SELECT * FROM teams_meetings 
        WHERE user_email = ? 
        AND (
          (start_time >= ? AND start_time <= ?)  
          OR 
          (start_time < ? AND end_time > ?)       
        )
        ORDER BY start_time ASC
      `, [userEmail, nowAdjusted, next12Hours, nowAdjusted, nowAdjusted]);

      return result.map(row => ({
        subject: row.subject,
        start: row.start_time,
        end: row.end_time,
        duration: row.duration_minutes,
        bodyPreview: row.body_preview || '',
        description: row.body_preview || '',
        id: row.id,
        meetingId: row.id,
        organizer: row.user_email
      }));
    } catch (error) {
      logger.error('Failed to get cached meetings', { userEmail, error: error.message, stack: error.stack });
      return null;
    }
  }
}

export default new TeamsService();