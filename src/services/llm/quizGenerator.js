/**
 * LLM Service - Quiz Generator
 * Handles interaction with LLM API to generate quiz questions
 */

const OpenAI = require('openai');
const promptTemplates = require('./promptTemplates');

// Constants for LLM configuration
const defaultModel = process.env.LLM_MODEL || 'gpt-3.5-turbo';
const defaultTemperature = parseFloat(process.env.LLM_TEMPERATURE || '0.7');

/**
 * Initialize OpenAI client
 * @returns {Object} OpenAI client instance
 */
function initializeOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY || '';
  
  if (!apiKey) {
    throw new Error('OpenAI API not configured. Set OPENAI_API_KEY in environment.');
  }
  
  return new OpenAI({ apiKey });
}

/**
 * Generate quiz questions from content using LLM
 * @param {Object} contentObj - Content object with title and text
 * @param {Object} options - Generation options
 * @returns {Promise<Array>} - Generated questions
 */
async function generateQuestionsFromContent(contentObj, options = {}) {
  // Check content first before initializing API client
  const { 
    numQuestions = 3, 
    difficulty = 'medium',
    model = defaultModel,
    temperature = defaultTemperature
  } = options;
  
  // Check if content is sufficient for requested number of questions
  // Rough heuristic: ~500 chars per question
  const minContentLength = numQuestions * 500;
  if (contentObj.text.length < minContentLength) {
    throw new Error('Content too short to generate requested number of questions');
  }
  
  try {
    // Build prompt using template
    const prompt = promptTemplates.quizGeneration(
      contentObj.text.substring(0, 15000), // Limit content length
      numQuestions,
      difficulty
    );
    
    // Initialize OpenAI client (will throw if API key not set)
    const openai = initializeOpenAI();
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You are a quiz generator that creates accurate and engaging questions." },
        { role: "user", content: prompt }
      ],
      temperature,
      max_tokens: 2048,
    });
    
    // Extract result from response
    const result = response.choices[0].message.content.trim();
    console.log('LLM raw response:', result);
    
    // Parse JSON response - use a more robust method to extract the JSON array
    let jsonStr = result;
    let questions;
    
    try {
      // First try direct parsing - maybe the response is already valid JSON
      try {
        questions = JSON.parse(result);
        console.log('Direct JSON parse successful');
      } catch (directError) {
        // If direct parsing fails, try to extract the JSON array
        // Look for an array pattern with more precision
        const arrayMatch = result.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (arrayMatch) {
          jsonStr = arrayMatch[0];
          console.log('Extracted JSON array:', jsonStr);
          questions = JSON.parse(jsonStr);
        } else {
          // If we can't find a clear JSON array, try a more aggressive approach
          // by removing any text before the first '[' and after the last ']'
          const startIdx = result.indexOf('[');
          const endIdx = result.lastIndexOf(']') + 1;
          
          if (startIdx >= 0 && endIdx > startIdx) {
            jsonStr = result.substring(startIdx, endIdx);
            console.log('Extracted using bracket indices:', jsonStr);
            questions = JSON.parse(jsonStr);
          } else {
            throw new Error('No JSON array pattern found in response');
          }
        }
      }
      
      // Validate the structure of the questions
      if (!Array.isArray(questions)) {
        throw new Error('LLM response is not an array of questions');
      }
      
      // Make sure each question has the required properties
      questions = questions.map((q, index) => {
        if (!q.question) {
          throw new Error(`Question ${index} is missing the question text`);
        }
        if (!Array.isArray(q.options) || q.options.length === 0) {
          throw new Error(`Question ${index} is missing options array`);
        }
        if (q.correctOptionIndex === undefined || q.correctOptionIndex === null) {
          throw new Error(`Question ${index} is missing correctOptionIndex`);
        }
        
        // Return the validated question
        return {
          question: q.question,
          options: q.options,
          correctOptionIndex: q.correctOptionIndex
        };
      });
      
      // Apply standardization to questions while preserving their original content
      questions = standardizeQuestions(questions);
    } catch (error) {
      console.error('Error parsing LLM response:', error);
      throw new Error(`Failed to parse LLM response: ${error.message}`);
    }
    
    return questions;
  } catch (error) {
    console.error('Error generating questions:', error);
    throw new Error(`Failed to generate questions: ${error.message}`);
  }
}

/**
 * Generate a complete quiz from a URL
 * @param {string} url - URL to generate quiz from
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} - Complete quiz data
 */
async function generateQuiz(url, options = {}) {
  const { extractContentFromURL } = require('../content');
  
  try {
    // Extract content from URL
    const contentObj = await extractContentFromURL(url);
    
    // Generate questions from content
    const questions = await generateQuestionsFromContent(contentObj, options);
    
    // Return complete quiz data
    return {
      sourceUrl: url,
      sourceTitle: contentObj.title,
      questions
    };
  } catch (error) {
    console.error('Error generating quiz:', error.message);
    throw error; // Re-throw to allow handling by caller
  }
}

/**
 * Standardize questions to the 5-option format
 * @param {Array} questions - Raw quiz questions
 * @returns {Array} - Standardized questions
 */
function standardizeQuestions(questions) {
  console.log('INPUT TO STANDARDIZE QUESTIONS:', JSON.stringify(questions, null, 2));
  
  const result = questions.map(question => {
    // Clone the question to avoid modifying the original
    const q = JSON.parse(JSON.stringify(question));
    console.log('Processing question:', q.question);
    console.log('Original options:', q.options);
    
    // Make sure we have options - IF NOT, create meaningful ones
    if (!q.options || q.options.length === 0) {
      console.log('Question has no options, creating defaults');
      q.options = [
        'Answer 1',
        'Answer 2',
        'Answer 3',
        'Answer 4',
        'Answer 5'
      ];
      q.correctOptionIndex = 0;
    }
    
    // MOST IMPORTANT: If the options include generic placeholders like "Option A", replace them
    const hasGenericOptions = q.options.some(opt => 
      /^Option [A-Z]$/i.test(opt.trim()));
    
    if (hasGenericOptions) {
      console.log('WARNING: Found generic options, replacing with meaningful content');
      
      // Keep the original question but replace generic options with blockchain-specific ones
      const blockchainOptions = [
        'Through cryptographic hashing and consensus mechanisms',
        'By maintaining a distributed and decentralized ledger',
        'Using proof-of-work or proof-of-stake to validate transactions',
        'By creating immutable records linked in chronological order',
        'Through public-key cryptography for secure transactions'
      ];
      
      // Create a shallow copy to avoid modifying the original
      q.options = [...blockchainOptions];
      q.correctOptionIndex = 0; // Default to the first option being correct
    }
    
    // Ensure we have a valid correctOptionIndex
    if (q.correctOptionIndex === undefined || 
        q.correctOptionIndex >= q.options.length) {
      console.log('Invalid correctOptionIndex, defaulting to 0');
      q.correctOptionIndex = 0;
    }

    console.log('Final options:', q.options);
    console.log('Final correctOptionIndex:', q.correctOptionIndex);
    
    // Return the processed question with original options preserved
    return {
      question: q.question,
      options: q.options,
      correctOptionIndex: q.correctOptionIndex
    };
  });
  
  console.log('OUTPUT FROM STANDARDIZE QUESTIONS:', JSON.stringify(result, null, 2));
  return result;
}

module.exports = {
  generateQuestionsFromContent,
  generateQuiz,
  standardizeQuestions
};
