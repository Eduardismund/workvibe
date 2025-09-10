import { useState, useEffect } from 'react';
import api from '../utils/api';

function TeamsAuth({ onAuthSuccess }) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authStatus, setAuthStatus] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check auth status on component mount (without showing loading)
    checkAuthStatus(false);
    
    // Check if we're returning from auth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth') === 'success') {
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      setIsAuthenticated(true);
      onAuthSuccess(true);
    }
  }, [onAuthSuccess]);

  const handleAuthenticate = async () => {
    setIsAuthenticating(true);
    setAuthStatus(null);
    
    try {
      // Open auth in popup window instead of redirecting
      const authUrl = 'http://localhost:3002/api/auth/login';
      const authWindow = window.open(
        authUrl, 
        'teams-auth', 
        'width=600,height=700,left=100,top=100'
      );
      
      // Check if auth window is closed and poll for auth status
      const checkInterval = setInterval(async () => {
        if (authWindow && authWindow.closed) {
          clearInterval(checkInterval);
          // Window closed, check if auth was successful
          const authSuccess = await checkAuthStatus(true);
          if (!authSuccess) {
            setIsAuthenticating(false);
          }
          window.removeEventListener('message', handleMessage);
        } else {
          // Also periodically check auth status while window is open
          const authSuccess = await checkAuthStatus(false);
          if (authSuccess && authWindow && !authWindow.closed) {
            clearInterval(checkInterval);
            authWindow.close();
            window.removeEventListener('message', handleMessage);
          }
        }
      }, 1000);

      // Also listen for messages from the auth window
      const handleMessage = (event) => {
        console.log('Received message in main window:', event.data, 'from:', event.origin);
        
        // Accept messages from the backend server
        if (event.origin === 'http://localhost:3002') {
          const isAuthSuccess = 
            event.data === 'auth-success' ||
            (event.data && event.data.type === 'auth-success');
            
          if (isAuthSuccess) {
            console.log('Authentication successful, updating UI');
            clearInterval(checkInterval);
            setIsAuthenticated(true);
            setIsAuthenticating(false);
            onAuthSuccess(true);
            window.removeEventListener('message', handleMessage);
            
            // Send close message to popup and try to close it
            if (authWindow && !authWindow.closed) {
              authWindow.postMessage('close-popup', 'http://localhost:3002');
              setTimeout(() => {
                if (!authWindow.closed) {
                  authWindow.close();
                }
              }, 500);
            }
          }
        }
      };
      
      window.addEventListener('message', handleMessage);
      
    } catch (error) {
      console.error('Authentication error:', error);
      setIsAuthenticating(false);
    }
  };

  const checkAuthStatus = async (showLoading = true) => {
    if (showLoading) {
      setIsAuthenticating(true);
    }
    
    try {
      // Check if we can get today's meetings as auth verification
      const response = await api.get('/teams/today');
      if (response.data.events !== undefined) {
        setIsAuthenticated(true);
        onAuthSuccess(true);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    } finally {
      if (showLoading) {
        setIsAuthenticating(false);
      }
    }
  };

  return (
    <div className="teams-auth">
      <button 
        onClick={handleAuthenticate} 
        disabled={isAuthenticating}
        className="auth-button"
      >
        {isAuthenticating ? (
          <><i className="fas fa-circle-notch fa-spin"></i> Authenticating...</>
        ) : (
          <><i className="fab fa-microsoft"></i> Authenticate with Teams</>
        )}
      </button>
    </div>
  );
}

export default TeamsAuth;