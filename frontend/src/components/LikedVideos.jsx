function LikedVideos({ likedVideos, onLikedVideosChange }) {
  const handleUnlikeVideo = (video) => {
    const videoId = video.video_id || video.videoId;
    if (!videoId) return;

    const newLiked = likedVideos.filter(v => (v.video_id || v.videoId) !== videoId);
    if (onLikedVideosChange) {
      onLikedVideosChange(newLiked);
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
    </div>
  );
}

export default LikedVideos;