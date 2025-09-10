import { useState } from 'react';

function RefreshFeed({ hasIngestedRecommendations, onRefreshFeed }) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshFeed = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshFeed();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="refresh-feed-component">
      <button 
        onClick={handleRefreshFeed}
        disabled={!hasIngestedRecommendations || isRefreshing}
        className={`refresh-feed-button ${!hasIngestedRecommendations ? 'disabled' : ''}`}
      >
        {isRefreshing ? (
          <><i className="fas fa-circle-notch fa-spin"></i> Refreshing...</>
        ) : (
          <><i className="fas fa-sync-alt"></i> Refresh Feed</>
        )}
      </button>
    </div>
  );
}

export default RefreshFeed;