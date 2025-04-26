// YouTube API key from your provided key
const YOUTUBE_API_KEY = 'AIzaSyBCyoxXoj5mY2MeOCKzQqyBwVVoiC-8yDs';

// Set to false to use real data from the YouTube API
const USE_MOCK_DATA = false;

/**
 * Search for YouTube videos containing the search term in the title
 * @param {string} searchTerm - The term to search for in video titles
 * @param {number} maxResults - Maximum number of results to return
 * @returns {Promise<Array>} - Array of video search results
 */
export const searchVideos = async (searchTerm, maxResults = 50) => {
  try {
    if (USE_MOCK_DATA) {
      console.log('Using mock data for search');
      // Return mock search results
      return {
        items: [
          {
            id: { videoId: 'mock-video-1' },
            snippet: {
              title: `${searchTerm} - Tutorial Video`,
              description: 'This is a mock video description',
              channelId: 'mock-channel-1',
              channelTitle: 'Tech Channel',
              thumbnails: {
                medium: { url: 'https://via.placeholder.com/320x180.png?text=Video+Thumbnail' }
              }
            }
          },
          {
            id: { videoId: 'mock-video-2' },
            snippet: {
              title: `Learn about ${searchTerm}`,
              description: 'Another mock video description',
              channelId: 'mock-channel-2',
              channelTitle: 'Learning Channel',
              thumbnails: {
                medium: { url: 'https://via.placeholder.com/320x180.png?text=Video+Thumbnail+2' }
              }
            }
          },
          {
            id: { videoId: 'mock-video-3' },
            snippet: {
              title: `${searchTerm} Explained`,
              description: 'Third mock video description',
              channelId: 'mock-channel-3',
              channelTitle: 'Explainer Channel',
              thumbnails: {
                medium: { url: 'https://via.placeholder.com/320x180.png?text=Video+Thumbnail+3' }
              }
            }
          }
        ]
      };
    }
    
    const searchResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
        searchTerm
      )}&type=video&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`
    );
    
    if (!searchResponse.ok) {
      throw new Error('Failed to fetch videos');
    }
    
    return await searchResponse.json();
  } catch (error) {
    console.error('Error searching videos:', error);
    if (USE_MOCK_DATA) {
      // If we're using mock data but still got an error, return empty results
      return { items: [] };
    }
    throw error;
  }
};

/**
 * Get detailed information about a list of videos
 * @param {string} videoIds - Comma-separated list of video IDs
 * @returns {Promise<Array>} - Array of video details
 */
export const getVideoDetails = async (videoIds) => {
  try {
    if (USE_MOCK_DATA) {
      console.log('Using mock data for video details');
      // Parse the videoIds string to get an array of IDs
      const idArray = videoIds.split(',');
      
      // Create mock video details for each ID
      const mockItems = idArray.map((id, index) => ({
        id,
        snippet: {
          title: `Mock Video ${index + 1}`,
          description: `This is a mock description for video ${id}`,
          channelId: `mock-channel-${index + 1}`,
          channelTitle: `Channel ${index + 1}`,
          thumbnails: {
            medium: { url: `https://via.placeholder.com/320x180.png?text=Video+${index + 1}` }
          }
        },
        contentDetails: {
          duration: 'PT10M30S',
          caption: 'true' // All mock videos have captions
        },
        statistics: {
          viewCount: String(Math.floor(Math.random() * 1000000)),
          likeCount: String(Math.floor(Math.random() * 50000)),
          commentCount: String(Math.floor(Math.random() * 5000))
        }
      }));
      
      return { items: mockItems };
    }
    
    const videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`
    );
    
    if (!videosResponse.ok) {
      throw new Error('Failed to fetch video details');
    }
    
    return await videosResponse.json();
  } catch (error) {
    console.error('Error getting video details:', error);
    if (USE_MOCK_DATA) {
      return { items: [] };
    }
    throw error;
  }
};

/**
 * Get channel information including subscriber count
 * @param {string} channelId - The channel ID
 * @returns {Promise<Object>} - Channel details
 */
export const getChannelInfo = async (channelId) => {
  try {
    if (USE_MOCK_DATA) {
      console.log('Using mock data for channel info');
      // Generate a random subscriber count between 100k and 10M
      const subscriberCount = Math.floor(Math.random() * 9900000) + 100000;
      
      return {
        items: [
          {
            id: channelId,
            statistics: {
              subscriberCount: String(subscriberCount),
              viewCount: String(subscriberCount * 50),
              videoCount: String(Math.floor(Math.random() * 500) + 50)
            }
          }
        ]
      };
    }
    
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`
    );
    
    if (!channelResponse.ok) {
      throw new Error('Failed to fetch channel info');
    }
    
    return await channelResponse.json();
  } catch (error) {
    console.error('Error getting channel info:', error);
    if (USE_MOCK_DATA) {
      // Return a default channel with the minimum follower count
      return {
        items: [
          {
            id: channelId,
            statistics: {
              subscriberCount: '150000',
              viewCount: '7500000',
              videoCount: '120'
            }
          }
        ]
      };
    }
    throw error;
  }
};

/**
 * Get transcript for a video (this would typically be a backend API call)
 * For now, this is a mock implementation
 * @param {string} videoId - The video ID
 * @returns {Promise<string>} - The transcript text
 */
export const getVideoTranscript = async (videoId) => {
  // In a real implementation, this would call a backend API
  // that uses a library like youtube-transcript-api
  
  // For demonstration purposes, we'll return a mock transcript
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`This is a sample transcript for video ${videoId}.
It would contain the actual text from the video.
In a real application, this would be fetched from YouTube's API.
The transcript would be properly formatted and timed.`);
    }, 1000);
  });
};
