import { useState } from 'react';
import api from '../utils/api';

function LikedVideos({ likedVideos, onLikedVideosChange, onLikedVideosIngested }) {
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionStatus, setIngestionStatus] = useState(null);
  const [error, setError] = useState(null);

  const handleUnlikeVideo = (video) => {
    const videoId = video.video_id || video.videoId;
    if (!videoId) return;

    const newLiked = likedVideos.filter(v => (v.video_id || v.videoId) !== videoId);
    if (onLikedVideosChange) {
      onLikedVideosChange(newLiked);
    }
  };

  const handleIngestLikedVideos = async () => {
    if (likedVideos.length === 0) {
      setError('No liked videos to ingest');
      return;
    }

    setIsIngesting(true);
    setError(null);
    setIngestionStatus(null);

    try {
      const videoIds = likedVideos.map(v => v.video_id || v.videoId);
      
      const response = await api.post('/agent/ingest-liked-videos', {
        likedVideoIds: videoIds
      });

      console.log('Liked videos ingestion response:', response.data);
      
      if (response.data.success) {
        setIngestionStatus({
          success: true,
          message: `Successfully ingested ${response.data.data?.totalVideosStored || 0} videos`
        });
        
        if (onLikedVideosIngested) {
          onLikedVideosIngested(response.data.data);
        }
        
        // Clear the liked videos list after successful ingestion
        if (onLikedVideosChange) {
          setTimeout(() => {
            onLikedVideosChange([]);
          }, 2000); // Wait 2 seconds to show success message first
        }
      }
    } catch (error) {
      console.error('Liked videos ingestion error:', error);
      setError('Failed to ingest liked videos. Please try again.');
    } finally {
      setIsIngesting(false);
    }
  };


  if (likedVideos.length === 0) {
    return (
      <div className="liked-videos-content">
        <p className="info">No liked videos yet. Heart videos in the results to add them here.</p>
      </div>
    );
  }

  return (
    <div className="liked-videos-content">
      <div className="liked-videos-list">
        {likedVideos.map((video, index) => (
          <div key={video.video_id || video.videoId || index} className="liked-video-item">
            <span className="video-title">{video.title}</span>
            <button 
              onClick={() => handleUnlikeVideo(video)}
              className="unlike-button"
              title="Remove from liked videos"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      
      {likedVideos.length > 0 && (
        <div className="liked-videos-actions">
          <button 
            onClick={handleIngestLikedVideos}
            disabled={isIngesting}
            className="ingest-liked-button"
            title="Ingest recommended videos based on your liked videos"
          >
            {isIngesting ? (
              <><i className="fas fa-circle-notch fa-spin"></i> Ingesting...</>
            ) : (
              <><i className="fas fa-server"></i> Ingest Recommended Videos</>
            )}
          </button>
        </div>
      )}

      {ingestionStatus && (
        <div className={`ingestion-status ${ingestionStatus.success ? 'success' : 'error'}`}>
          {ingestionStatus.message}
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

    </div>
  );
}

export default LikedVideos;