/**
 * OpenAI LLM Client Service
 * Handles interaction with the OpenAI API for quiz generation
 */

const OpenAI = require('openai');

/**
 * Initialize OpenAI client with API key
 * @returns {OpenAI} Configured OpenAI client instance
 */
function initializeOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY || '';
  
  // Check if we're in demo/test mode
  const isDemoMode = process.env.OPENAI_DEMO_MODE === 'true' || !apiKey;
  
  if (isDemoMode) {
    console.log('WARNING: Using DEMO MODE for OpenAI - quiz answers will be mock data');
    
    // Return a mock client with the same interface
    return {
      chat: {
        completions: {
          create: async (params) => {
            // Create a deterministic but reasonable mock response
            const topic = params.messages[0]?.content || 'general knowledge';
            const numQuestions = 3; // Default number of questions
            
            return {
              choices: [{
                message: {
                  content: JSON.stringify({
                    questions: Array(numQuestions).fill(null).map((_, i) => ({
                      question: `Sample question ${i + 1} about ${topic}`,
                      options: [
                        `Sample correct answer for question ${i + 1}`,
                        `Sample incorrect answer A for question ${i + 1}`,
                        `Sample incorrect answer B for question ${i + 1}`,
                        `Sample incorrect answer C for question ${i + 1}`
                      ],
                      correctAnswer: 0
                    }))
                  })
                }
              }]
            };
          }
        }
      }
    };
  }
  
  // Normal OpenAI client when API key is available
  return new OpenAI({
    apiKey,
    timeout: 30000 // 30 seconds timeout
  });
}

/**
 * Generate text completion using OpenAI API
 * @param {string} prompt - The prompt to send to OpenAI
 * @param {Object} options - Generation options
 * @returns {Promise<string>} - Generated text
 */
async function generateCompletion(prompt, options = {}) {
  try {
    const openai = initializeOpenAIClient();
    console.log('Connecting to OpenAI API...');
    
    // Build a request that follows the OpenAI chat completions format
    const requestData = {
      model: options.model || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that creates quiz questions based on provided content. Your response should be a JSON array of questions, each with "question", "options" (array of strings), and "correctOptionIndex" (number). Example: [{"question":"What is...?", "options":["A", "B", "C"], "correctOptionIndex":0}]' },
        { role: 'user', content: prompt }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2000
    };
    
    // Log the request for debugging
    console.log('OpenAI API request:', JSON.stringify(requestData, null, 2));
    
    // Make the API request
    const response = await openai.chat.completions.create(requestData);
    
    // Log successful response
    console.log('OpenAI API response received successfully');
    
    // Extract the generated text from the response
    return response.choices[0].message.content || '';
  } catch (error) {
    console.error('OpenAI API error details:');
    
    // Different error structure depending on OpenAI SDK version
    if (error.response) {
      // Classic error format
      console.error('Status code:', error.response.status);
      console.error('Response data:', error.response.data);
      throw new Error(`OpenAI API request failed with status code ${error.response.status}: ${JSON.stringify(error.response.data)}`);
    } else if (error.status) {
      // New SDK error format
      console.error('Status code:', error.status);
      console.error('Error type:', error.type);
      console.error('Error message:', error.message);
      throw new Error(`OpenAI API request failed: ${error.message}`);
    } else {
      // Generic error
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      // Enable demo mode for subsequent requests
      process.env.OPENAI_DEMO_MODE = 'true';
      console.log('Switched to DEMO MODE due to API error');
      
      // Retry the request once with demo mode
      try {
        return await generateCompletion(prompt, options);
      } catch (retryError) {
        console.error('Error even in demo mode:', retryError);
        throw new Error(`OpenAI API unavailable and demo mode failed: ${error.message}`);
      }
    }
  }
}

module.exports = {
  initializeOpenAIClient,
  generateCompletion
};
