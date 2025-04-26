// Gemini API key from your provided key
const GEMINI_API_KEY = 'AIzaSyBkRj0-HEGzDcYBdjy-n1fs5d6ZqzUlgYQ';

/**
 * Process a transcript using Google's Gemini API
 * @param {string} transcript - The transcript text to process
 * @returns {Promise<string>} - The processed/summarized transcript
 */
export const processTranscript = async (transcript, customPrompt) => {
  try {
    const prompt = customPrompt
      ? customPrompt
      : `Please summarize the following YouTube transcript with bulletpoints, takeaway messages, and key points.\n\nTranscript:\n${transcript}`;
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_API_KEY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ]
      })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to process transcript');
    }
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No summary returned.';
  } catch (error) {
    console.error('Error processing transcript with Gemini:', error);
    throw error;
  }
};
