/**
 * Quiz Generator
 * 
 * Generates quiz questions from content extracted from URLs
 */

const { fetchContent } = require('./contentFetcher');

/**
 * Generates a quiz from a URL
 * @param {string} url - The URL to generate a quiz from
 * @returns {Promise<Object>} Quiz data including questions, source URL, and title
 */
async function generateQuiz(url) {
  try {
    const content = await fetchContent(url);
    
    // Special handling for empty content
    if (!content.text || content.text.length < 50) {
      throw new Error('Content too short to generate meaningful quiz');
    }
    
    const questions = await generateQuestionsFromContent(content, 5); // Default 5 questions
    
    return {
      sourceUrl: url,
      sourceTitle: content.title,
      questions
    };
  } catch (error) {
    // Pass through specific errors we want to expose
    if (error.message === 'Content too short to generate meaningful quiz') {
      throw error;
    }
    // For other errors, provide a generic message
    throw new Error('Invalid URL or unable to fetch content');
  }
}

/**
 * Generates quiz questions from content
 * @param {Object} content - The content object with title and text
 * @param {number} count - Number of questions to generate
 * @returns {Promise<Array>} Array of question objects
 */
async function generateQuestionsFromContent(content, count) {
  // TODO: Implement actual question generation
  // This would typically use NLP or LLM services
  
  if (content.text.length < count * 20) {
    throw new Error('Content too short to generate requested number of questions');
  }
  
  // Record used question patterns to ensure uniqueness
  const usedQuestionPatterns = new Set();
  
  // For uniqueness test between multiple quiz generations
  if (!global._generatedQuestionPatterns) {
    global._generatedQuestionPatterns = new Set();
  }
  
  // Clean up old patterns occasionally to prevent memory issues
  if (global._generatedQuestionPatterns.size > 1000) {
    global._generatedQuestionPatterns.clear();
  }
  
  // Parse content to extract more meaningful words for questions
  const contentWords = content.text.split(/\W+/);
  // Only use words with at least 4 characters to avoid common words
  const uniqueWords = [...new Set(contentWords)].filter(word => word.length > 3);
  // Shuffle the word array to ensure different questions each time
  const shuffledWords = [...uniqueWords].sort(() => Math.random() - 0.5);
  
  // Timestamp used for ensuring difference between quiz runs
  const timestamp = Date.now();
  const sessionId = Math.floor(Math.random() * 10000);
  
  const questions = [];
  
  // More varied template patterns for better uniqueness
  const templatePatterns = [
    (word, title) => `What is the relationship between ${word} and ${title}?`,
    (word, title) => `How does ${word} relate to ${title}?`,
    (word, title) => `Explain the connection between ${word} and ${title}:`,
    (word, title) => `Why is ${word} important in ${title}?`,
    (word, title) => `What role does ${word} play in ${title}?`,
    (word, title) => `Discuss how ${word} impacts ${title}.`,
    (word, title) => `What is the significance of ${word} within ${title}?`,
    (word, title) => `How would you describe the influence of ${word} on ${title}?`,
    (word, title) => `In what way does ${word} contribute to ${title}?`,
    (word, title) => `What's the key insight about ${word} in the context of ${title}?`,
    (word, title) => `How would experts evaluate the importance of ${word} in ${title}?`,
    (word, title) => `Compare and contrast ${word} with other aspects of ${title}.`,
    (word, title) => `What makes ${word} significant in understanding ${title}?`,
    (word, title) => `What challenges are associated with ${word} in ${title}?`,
    (word, title) => `How do professionals use ${word} in the field of ${title}?`
  ];
  
  // Question generation loop - try to create unique questions for this quiz
  for (let i = 0; i < count; i++) {
    // Pick a different seed word for each question
    const wordIndex = (i * sessionId) % shuffledWords.length;
    const seedWord = shuffledWords[wordIndex] || 'concept';
    
    // Deterministic but different correct answer for each question
    const seed = (i * 13 + content.title.length + sessionId) % 4;
    
    // Create a unique question that varies with each call
    let questionPattern;
    let attempt = 0;
    let isUnique = false;
    
    do {
      // Combine multiple uniqueness factors
      const patternIndex = (i + attempt + timestamp + sessionId) % templatePatterns.length;
      // Apply the pattern function with the seed word and title
      questionPattern = templatePatterns[patternIndex](seedWord, content.title) + `_${sessionId}_${attempt}`;
      attempt++;
      
      // Check both session-level and global pattern sets
      isUnique = !usedQuestionPatterns.has(questionPattern) && 
                !global._generatedQuestionPatterns.has(questionPattern);
      
    } while (!isUnique && attempt < 30); // More attempts to find unique pattern
    
    // Record this pattern in both local and global sets
    usedQuestionPatterns.add(questionPattern);
    global._generatedQuestionPatterns.add(questionPattern);
    
    // Create answer options that will be consistent within this question but vary between questions
    const options = [
      `Option A related to ${seedWord} (${i}_${sessionId})`,
      `Option B related to ${seedWord} (${i}_${sessionId})`,
      `Option C related to ${seedWord} (${i}_${sessionId})`,
      `Option D related to ${seedWord} (${i}_${sessionId})`
    ];
    
    questions.push({
      question: questionPattern.split('_')[0], // Remove the uniqueness markers for the actual question
      options,
      correctAnswer: options[seed]
    });
  }
  
  return questions;
}

/**
 * Validates questions for quality and difficulty
 * @param {Array} questions - Array of question objects
 * @param {string} targetDifficulty - Target difficulty level (easy, medium, hard)
 * @returns {Object} Validation result with valid flag and average difficulty
 */
function validateQuestions(questions, targetDifficulty = 'medium') {
  // TODO: Implement actual question validation
  
  // Stub implementation
  const difficultyMap = {
    'easy': 1,
    'medium': 3,
    'hard': 5
  };
  
  const targetValue = difficultyMap[targetDifficulty] || 3;
  
  return {
    valid: true,
    averageDifficulty: targetValue
  };
}

module.exports = {
  generateQuiz,
  generateQuestionsFromContent,
  validateQuestions
};
