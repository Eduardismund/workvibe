import TeamsService from '../services/TeamsService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

class TeamsController {
  getTodaysMeetings = asyncHandler(async (req, res) => {
    if (!req.session?.accessToken) {
      return res.status(401).json({
        message: 'Not authenticated. Go to /api/auth/login'
      });
    }
    
    try {
      // Use the actual email from session, fallback to userPrincipalName
      const userEmail = req.session.userEmail || req.session.userPrincipalName || 'eduard.jitareanu@stud.ubbcluj.ro';
      const events = await TeamsService.getCachedMeetings(userEmail);

      res.json({
        count: events.length,
        events: events,
        meetings: events.map(event => ({
          subject: event.subject,
          start: event.start,
          end: event.end,
          duration: event.duration,
        }))
      });
      
    } catch (error) {
      if (error.message.includes('401')) {
        return res.status(401).json({ message: 'Login expired. Go to /api/auth/login' });
      }
      
      res.status(500).json({ message: 'Failed to get meetings' });
    }
  });

  // Send message to Teams meeting by calendar event ID
  sendEventMessage = asyncHandler(async (req, res) => {
    if (!req.session?.accessToken) {
      return res.status(401).json({
        message: 'Not authenticated. Go to /api/auth/login'
      });
    }

    const { eventId } = req.params;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Message content is required'
      });
    }

    try {
      const result = await TeamsService.sendEventMessage(
        eventId, 
        message.trim(), 
        req.session.accessToken
      );

      res.status(200).json({
        status: 'success',
        data: {
          messageId: result.messageId,
          chatThreadId: result.chatThreadId,
          sentAt: result.sentAt,
          eventId
        }
      });

    } catch (error) {
      logger.error('Failed to send event message', { 
        eventId, 
        errorMessage: error.message,
        hasAccessToken: !!req.session?.accessToken 
      });
      
      if (error.message.includes('401') || error.message.includes('403')) {
        return res.status(401).json({ 
          status: 'error',
          message: 'Authentication failed. Go to /api/auth/login' 
        });
      }

      res.status(500).json({ 
        status: 'error',
        message: error.message || 'Failed to send event message' 
      });
    }
  });

  // List user's chats for debugging
  listUserChats = asyncHandler(async (req, res) => {
    if (!req.session?.accessToken) {
      return res.status(401).json({
        message: 'Not authenticated. Go to /api/auth/login'
      });
    }

    try {
      const chatsEndpoint = `/me/chats`;
      const chats = await TeamsService.makeGraphApiCall(chatsEndpoint, req.session.accessToken);
      
      res.status(200).json({
        status: 'success',
        data: {
          count: chats.value?.length || 0,
          chats: chats.value?.map(chat => ({
            id: chat.id,
            topic: chat.topic,
            chatType: chat.chatType,
            webUrl: chat.webUrl,
            createdDateTime: chat.createdDateTime
          }))
        }
      });

    } catch (error) {
      logger.error('Failed to list chats', { 
        errorMessage: error.message 
      });
      
      res.status(500).json({ 
        status: 'error',
        message: error.message || 'Failed to list chats' 
      });
    }
  });

  // Send message to Teams meeting by meeting ID
  sendMeetingMessage = asyncHandler(async (req, res) => {
    if (!req.session?.accessToken) {
      return res.status(401).json({
        message: 'Not authenticated. Go to /api/auth/login'
      });
    }

    const { meetingId } = req.params;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Message content is required'
      });
    }

    try {
      const result = await TeamsService.sendMeetingMessage(
        meetingId, 
        message.trim(), 
        req.session.accessToken
      );

      res.status(200).json({
        status: 'success',
        data: {
          messageId: result.messageId,
          chatThreadId: result.chatThreadId,
          sentAt: result.sentAt,
          meetingId
        }
      });

    } catch (error) {
      if (error.message.includes('401') || error.message.includes('403')) {
        return res.status(401).json({ 
          status: 'error',
          message: 'Authentication failed. Go to /api/auth/login' 
        });
      }

      res.status(500).json({ 
        status: 'error',
        message: error.message || 'Failed to send meeting message' 
      });
    }
  });


}

export default new TeamsController();