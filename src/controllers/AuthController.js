import { ConfidentialClientApplication } from '@azure/msal-node';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import TeamsService from '../services/TeamsService.js';

class AuthController {
  constructor() {
    this.msalConfig = {
      auth: {
        clientId: config.external.microsoft.clientId,
        authority: `https://login.microsoftonline.com/${config.external.microsoft.tenantId}`,
        clientSecret: config.external.microsoft.clientSecret
      }
    };
    
    this.msalClient = new ConfidentialClientApplication(this.msalConfig);
    this.SCOPES = [
      'openid', 
      'profile', 
      'email', 
      'Calendars.Read',
      'Chat.Read',
      'Chat.ReadWrite',
      'ChatMessage.Send',
      'OnlineMeetings.Read',
      'OnlineMeetings.ReadWrite'
    ];
  }

  login = asyncHandler(async (req, res) => {
    const authUrl = await this.msalClient.getAuthCodeUrl({
      scopes: this.SCOPES,
      redirectUri: config.external.microsoft.redirectUri,
      prompt: 'consent'
    });
    
    res.redirect(authUrl);
  });

  callback = asyncHandler(async (req, res) => {
    const { code } = req.query;
    
    if (!code) {
      return res.redirect('/api/teams/today?error=no_code');
    }

    try {
      const response = await this.msalClient.acquireTokenByCode({
        code: code,
        scopes: this.SCOPES,
        redirectUri: config.external.microsoft.redirectUri
      });
      
      req.session.accessToken = response.accessToken;
      req.session.account = response.account;
      req.session.isAuthenticated = true;
      req.session.userPrincipalName = response.account.username;
      req.session.userEmail = response.account.username; // Store email for cache lookup
      
      try {
        logger.info('Fetching and caching Teams meetings on login', { 
          userEmail: response.account.username 
        });
        
        await TeamsService.getUserCalendarEvents(response.account.username, {
          userToken: response.accessToken,
          userEmail: response.account.username,
          forceRefresh: true
        });
        
      } catch (cacheError) {
        logger.warn('Failed to fetch and cache meetings on login', { error: cacheError.message });
      }
      
      res.redirect('/api/teams/today');
      
    } catch (error) {
      logger.error('Auth failed', error);
      res.redirect('/api/teams/today?error=auth_failed');
    }
  });

  logout = asyncHandler(async (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out' });
  });
}

export default new AuthController();