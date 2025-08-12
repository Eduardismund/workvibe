import { ConfidentialClientApplication } from '@azure/msal-node';
import config from '../config/index.js';
import logger from '../utils/logger.js';
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
  async makeGraphApiCall(endpoint, userToken = null) {
    const accessToken = userToken || await this.getAccessToken();
    
    const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Graph API error: ${response.status} - ${error}`);
    }
    
    return response.json();
  }
  
  /**
   * Get user's calendar events
   */
  async getUserCalendarEvents(userPrincipalName, options = {}) {
    try {
      const startDateTime = options.startTime || new Date().toISOString();
      const endDateTime = options.endTime || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const params = new URLSearchParams({
        '$filter': `start/dateTime ge '${startDateTime}' and end/dateTime le '${endDateTime}'`,
        '$orderby': 'start/dateTime',
        '$top': options.maxResults || 50,
        '$select': 'id,subject,start,end,location,organizer,isOnlineMeeting,onlineMeetingUrl'
      });
      
      // Use /me endpoint if userToken is provided
      const endpoint = options.userToken 
        ? `/me/calendar/events?${params.toString()}`
        : `/users/${userPrincipalName}/calendar/events?${params.toString()}`;
        
      const result = await this.makeGraphApiCall(endpoint, options.userToken);
      
      return this.formatCalendarEvents(result.value || []);
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
      location: event.location?.displayName || event.location?.uniqueId,
      organizer: {
        name: event.organizer?.emailAddress?.name,
        email: event.organizer?.emailAddress?.address
      },
      isOnlineMeeting: event.isOnlineMeeting,
      onlineMeetingUrl: event.onlineMeetingUrl
    }));
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
   * Check if Teams integration is configured
   */
  isConfigured() {
    return this._isConfigured;
  }
}

export default new TeamsService();