import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import './App.css';
import ChannelMonitor from './components/ChannelMonitor';
import {
  searchVideos,
  getVideoDetails,
  getChannelInfo,
  getVideoTranscript,
  iso8601DurationToSeconds
} from './services/youtubeService';
import { processTranscript } from './services/geminiService';

function App() {
  const [activeTab, setActiveTab] = useState('search');
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [bulkSummary, setBulkSummary] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [specialSummary, setSpecialSummary] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [minFollowers, setMinFollowers] = useState(100000);
  /** Minimum video length in seconds (0 = off). 61 hides most Shorts. */
  const [minVideoLengthSec, setMinVideoLengthSec] = useState(61);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTranscript, setActiveTranscript] = useState(null);
  const [processedTranscript, setProcessedTranscript] = useState(null);

  const handleSearch = async () => {
    if (!searchTerm) {
      setError('Please enter a search term');
      return;
    }

    setLoading(true);
    setError('');
    setVideos([]);
    setActiveTranscript(null);
    setProcessedTranscript(null);
    
    try {
      // First, search for videos with the search term in the title
      const searchData = await searchVideos(searchTerm);
      if (!searchData.items || searchData.items.length === 0) {
        setError('No videos found matching your search term');
        setLoading(false);
        return;
      }
      
      const videoIds = searchData.items.map(item => item.id.videoId).join(',');
      
      // Then, get detailed information about these videos
      const videosData = await getVideoDetails(videoIds);
      
      // Filter by captions, optional minimum duration (skip Shorts)
      const filteredVideos = videosData.items.filter((video) => {
        const hasCaptions = video.contentDetails.caption === 'true';
        if (!hasCaptions) return false;
        if (minVideoLengthSec > 0) {
          const sec = iso8601DurationToSeconds(video.contentDetails?.duration);
          if (sec < minVideoLengthSec) return false;
        }
        return true;
      });
      
      // For each video, check if the channel has enough subscribers
      const videoPromises = filteredVideos.map(async (video) => {
        const channelId = video.snippet.channelId;
        try {
          const channelData = await getChannelInfo(channelId);
          const subscriberCount = parseInt(channelData.items[0].statistics.subscriberCount);
          
          if (subscriberCount >= minFollowers) {
            return {
              ...video,
              channelSubscribers: subscriberCount
            };
          }
        } catch (err) {
          console.error(`Error fetching channel data for ${channelId}:`, err);
        }
        
        return null;
      });
      
      const resolvedVideos = await Promise.all(videoPromises);
      const validVideos = resolvedVideos.filter(video => video !== null);
      
      setVideos(validVideos);
      
      if (validVideos.length === 0) {
        setError(
          'No videos matched your filters (captions, minimum length, and follower count).'
        );
      }
    } catch (err) {
      setError('Error fetching videos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTranscript = async (videoId) => {
    try {
      setActiveTranscript({ videoId, loading: true });
      setProcessedTranscript(null);
      
      const transcript = await getVideoTranscript(videoId);
      
      setActiveTranscript({ 
        videoId, 
        loading: false, 
        text: transcript 
      });
    } catch (err) {
      setActiveTranscript({
        videoId,
        loading: false,
        error: err.message || 'Failed to load transcript'
      });
    }
  };

  const handleProcessTranscript = async (videoId, transcript) => {
    try {
      setProcessedTranscript({ loading: true });
      
      const processed = await processTranscript(transcript);
      
      setProcessedTranscript({
        loading: false,
        text: processed
      });
    } catch (err) {
      setProcessedTranscript({
        loading: false,
        error: 'Failed to process transcript'
      });
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Handle checkbox toggle
  const handleCheckboxChange = (videoId) => {
    setSelectedVideos((prev) =>
      prev.includes(videoId)
        ? prev.filter((id) => id !== videoId)
        : [...prev, videoId]
    );
  };

  // Bulk summarize handler
  const handleBulkSummarize = async () => {
    setBulkLoading(true);
    setBulkSummary(null);
    try {
      // Get all selected video objects
      const selectedVideoObjs = videos.filter((v) => selectedVideos.includes(v.id));
      // Fetch transcripts in parallel
      const transcripts = await Promise.all(
        selectedVideoObjs.map(async (video) => {
          try {
            const transcript = await getVideoTranscript(video.id);
            return { title: video.snippet.title, transcript };
          } catch {
            return { title: video.snippet.title, transcript: '[Transcript unavailable]' };
          }
        })
      );
      let prompt;
      if (specialSummary) {
        prompt = `You are an expert at extracting and synthesizing information from multiple sources.

Given the following YouTube video transcripts (provided below, separated clearly), perform the following for each video individually:

Chapterized Summary: Break down the video into logical chapters based on the content flow. Each chapter should have a short title and a concise summary (3-5 sentences).

Key Takeaways: List the 5-10 most important insights, lessons, or ideas from this video.

After completing the summaries for each individual video, analyze all the videos together and:

Unified Summary: Write a cohesive overview that connects the key themes and insights across all videos.

Main Takeaways: List the top 5-10 most important, actionable takeaways from the combined knowledge of all videos.

Formatting rules:

Clearly label each video (Video 1, Video 2, etc.) and its parts (Chapters, Key Takeaways).

Use bullet points for lists.

Keep language clear, insightful, and professional.

Avoid unnecessary repetition.

Input:\n` +
        transcripts.map((t, i) => `=== Video ${i + 1} ===\n${t.transcript}`).join('\n\n');
      } else {
        prompt =
          'Please Summarize all youtube transcript togheter with main bulletpoints, key takeaway messages etc. Make another short summary to point out similaritys and differences in the transcript.\n' +
          transcripts.map((t, i) => `Video${i + 1} (${t.title}): ${t.transcript}`).join('\n\n');
      }
      const summary = await processTranscript('', prompt);
      setBulkSummary(summary);
    } catch (err) {
      setBulkSummary('Failed to process bulk summary.');
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>YouTube Transcript Finder</h1>
        <p>
          {activeTab === 'search'
            ? 'Search for YouTube videos with available transcripts'
            : 'Monitor saved channels for new uploads and read transcripts'}
        </p>
        <nav className="app-tabs" aria-label="Main">
          <button
            type="button"
            className={activeTab === 'search' ? 'app-tab app-tab-active' : 'app-tab'}
            onClick={() => setActiveTab('search')}
          >
            Search
          </button>
          <button
            type="button"
            className={activeTab === 'channels' ? 'app-tab app-tab-active' : 'app-tab'}
            onClick={() => setActiveTab('channels')}
          >
            Channel monitor
          </button>
        </nav>
      </header>

      <main className="App-main">
        {activeTab === 'channels' ? (
          <ChannelMonitor />
        ) : (
          <>
        <div className="search-container">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter search term..."
            className="search-input"
          />
          
          <div className="followers-filter">
            <label htmlFor="minFollowers">Minimum followers:</label>
            <input
              type="number"
              id="minFollowers"
              value={minFollowers}
              onChange={(e) => setMinFollowers(Number(e.target.value))}
              min="0"
              step="1000"
              className="followers-input"
            />
          </div>

          <div className="followers-filter">
            <label htmlFor="minVideoLengthSec">Min. video length (sec):</label>
            <input
              type="number"
              id="minVideoLengthSec"
              value={minVideoLengthSec}
              onChange={(e) =>
                setMinVideoLengthSec(Math.max(0, Number(e.target.value) || 0))
              }
              min="0"
              step="1"
              title="0 = no minimum. 61 ≈ skip most Shorts."
              className="followers-input"
            />
          </div>

          <button 
            onClick={handleSearch} 
            className="search-button"
            disabled={loading}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="results-container">
          {videos.length > 0 && (
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={specialSummary}
                  onChange={e => setSpecialSummary(e.target.checked)}
                  style={{ marginRight: 6 }}
                />
                Special Summary
              </label>
              <button
                className="process-button"
                disabled={selectedVideos.length === 0 || bulkLoading}
                onClick={handleBulkSummarize}
              >
                {bulkLoading ? 'Processing...' : `Bulk Summarize (${selectedVideos.length})`}
              </button>
            </div>
          )}
          {bulkSummary && (
            <div className="processed-transcript">
              <h4>Bulk Summary</h4>
              <ReactMarkdown>{bulkSummary}</ReactMarkdown>
            </div>
          )}
          {videos.length > 0 ? (
            <div className="video-grid">
              {videos
                .slice()
                .sort((a, b) => new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt))
                .map((video) => (
                <div key={video.id} className="video-card">
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={selectedVideos.includes(video.id)}
                      onChange={() => handleCheckboxChange(video.id)}
                      style={{ marginRight: 8 }}
                    />
                  </div>
                  <img 
                    src={video.snippet.thumbnails.medium.url} 
                    alt={video.snippet.title}
                    className="video-thumbnail" 
                  />
                  <div className="video-info">
                    <h3 className="video-title">{video.snippet.title}</h3>
                    <p className="channel-name">{video.snippet.channelTitle}</p>
                    <p className="published-date">
                      Published: {new Date(video.snippet.publishedAt).toLocaleDateString()}
                    </p>
                    <p className="subscriber-count">
                      {video.channelSubscribers.toLocaleString()} subscribers
                    </p>
                    <div className="video-actions">
                      <a 
                        href={`https://www.youtube.com/watch?v=${video.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="watch-button"
                      >
                        Watch Video
                      </a>
                      <button 
                        onClick={() => fetchTranscript(video.id)}
                        className="transcript-button"
                      >
                        View Transcript
                      </button>
                    </div>
                    
                    {activeTranscript && activeTranscript.videoId === video.id && (
                      <div className="transcript-container">
                        {activeTranscript.loading ? (
                          <p>Loading transcript...</p>
                        ) : activeTranscript.error ? (
                          <p className="error-message">{activeTranscript.error}</p>
                        ) : (
                          <div className="transcript-text">
                            <h4>Transcript</h4>
                            <pre>{activeTranscript.text}</pre>
                            
                            <div className="transcript-actions">
                              <button 
                                onClick={() => handleProcessTranscript(video.id, activeTranscript.text)}
                                className="process-button"
                              >
                                Process with Gemini
                              </button>
                            </div>
                            
                            {processedTranscript && (
                              <div className="processed-transcript">
                                {processedTranscript.loading ? (
                                  <p>Processing transcript...</p>
                                ) : processedTranscript.error ? (
                                  <p className="error-message">{processedTranscript.error}</p>
                                ) : (
                                  <div>
                                    <h4>Processed Transcript</h4>
                                    <pre>{processedTranscript.text}</pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : !loading && (
            <p className="no-results">
              {searchTerm ? 'No videos found. Try a different search term or lower the follower threshold.' : 'Enter a search term to find videos.'}
            </p>
          )}
        </div>
          </>
        )}
      </main>
      
      <footer className="App-footer">
        <p>YouTube Transcript Finder &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

export default App;
