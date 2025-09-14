import { useState, useEffect } from 'react';
import api from '../utils/api';

function TeamsAuth({ onAuthSuccess }) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authStatus, setAuthStatus] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthStatus(false);
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth') === 'success') {
      window.history.replaceState({}, document.title, window.location.pathname);
      setIsAuthenticated(true);
      onAuthSuccess(true);
    }
  }, [onAuthSuccess]);

  const handleAuthenticate = async () => {
    setIsAuthenticating(true);
    setAuthStatus(null);
    
    try {
      const authUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3002/api'}/auth/login`;
      const authWindow = window.open(
        authUrl, 
        'teams-auth', 
        'width=600,height=700,left=100,top=100'
      );
      const checkInterval = setInterval(async () => {
        if (authWindow && authWindow.closed) {
          clearInterval(checkInterval);
          const authSuccess = await checkAuthStatus(true);
          if (!authSuccess) {
            setIsAuthenticating(false);
          }
          window.removeEventListener('message', handleMessage);
        } else {
          const authSuccess = await checkAuthStatus(false);
          if (authSuccess && authWindow && !authWindow.closed) {
            clearInterval(checkInterval);
            authWindow.close();
            window.removeEventListener('message', handleMessage);
          }
        }
      }, 1000);

      const handleMessage = (event) => {
        console.log('Received message in main window:', event.data, 'from:', event.origin);
        const expectedOrigin = import.meta.env.VITE_API_URL ? new URL(import.meta.env.VITE_API_URL).origin : 'http://localhost:3002';
        if (event.origin === expectedOrigin) {
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
            if (authWindow && !authWindow.closed) {
              const targetOrigin = import.meta.env.VITE_API_URL ? new URL(import.meta.env.VITE_API_URL).origin : 'http://localhost:3002';
              authWindow.postMessage('close-popup', targetOrigin);
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