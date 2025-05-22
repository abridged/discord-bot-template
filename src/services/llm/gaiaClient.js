/**
 * Gaia LLM Client Service
 * Handles interaction with the Gaia API for quiz generation
 */

const axios = require('axios');

// Constants for Gaia configuration
// Using the exact URL as specified
const GAIA_API_URL = 'https://mother.gaia.domains/v1';

/**
 * Initialize Gaia client with API key
 * @returns {Object} Configured Gaia client instance
 */
function initializeGaiaClient() {
  const apiKey = process.env.GAIA_API_KEY || '';
  
  if (!apiKey) {
    throw new Error('Gaia API not configured. Set GAIA_API_KEY in environment.');
  }
  
  return {
    apiKey,
    async generateCompletion(prompt, options = {}) {
      try {
        // Construct the full endpoint URL by appending the path
        const fullEndpointUrl = `${GAIA_API_URL}/chat/completions`;
        console.log(`Connecting to Gaia API at: ${fullEndpointUrl}`);
        
        // Build a request that follows the Gaia documentation
        const requestData = {
          messages: [
            { role: 'system', content: 'You are a helpful assistant that creates quiz questions based on provided content.' },
            { role: 'user', content: prompt }
          ],
          model: options.model || 'Llama-3-8B-Instruct-262k-Q5_K_M',
          temperature: options.temperature || 0.7
        };
        
        // Log the request for debugging
        console.log('Gaia API request:', JSON.stringify(requestData, null, 2));
        
        const response = await axios.post(fullEndpointUrl, requestData, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
          },
          // Add a longer timeout for API calls
          timeout: 30000
        });
        
        // Log successful response
        console.log('Gaia API response status:', response.status);
        console.log('Gaia API response headers:', response.headers);
        
        // Log the response data for debugging
        console.log('Gaia API response data:', JSON.stringify(response.data, null, 2));
        return response.data;
      } catch (error) {
        console.error('Gaia API error details:');
        
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error('Status code:', error.response.status);
          console.error('Response headers:', error.response.headers);
          console.error('Response data:', error.response.data);
          throw new Error(`Gaia API request failed with status code ${error.response.status}: ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
          // The request was made but no response was received
          console.error('No response received from Gaia API');
          console.error('Request details:', error.request);
          throw new Error('No response received from Gaia API - connection timeout or network error');
        } else {
          // Something happened in setting up the request that triggered an Error
          console.error('Error message:', error.message);
          console.error('Error config:', error.config);
          throw new Error(`Gaia API request setup error: ${error.message}`);
        }
      }
    }
  };
}

/**
 * Generate text completion using Gaia API
 * @param {string} prompt - The prompt to send to Gaia
 * @param {Object} options - Generation options
 * @returns {Promise<string>} - Generated text
 */
async function generateCompletion(prompt, options = {}) {
  const gaiaClient = initializeGaiaClient();
  
  try {
    const completion = await gaiaClient.generateCompletion(prompt, {
      maxTokens: options.maxTokens || 2000,
      temperature: options.temperature || 0.7,
      model: options.model || 'gaia-1'
    });
    
    // Extract the generated text from the response
    return completion.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('Error generating completion with Gaia:', error);
    throw error;
  }
}

module.exports = {
  initializeGaiaClient,
  generateCompletion
};
