/**
 * Quiz Validation Service
 * Validates quiz questions for quality and content relevance
 */

/**
 * Validate quiz questions against source content
 * @param {Array} questions - Questions to validate
 * @param {string} sourceContent - Original source content
 * @param {Object} options - Validation options
 * @returns {Object} - Validation results
 */
function validateQuiz(questions, sourceContent, options = {}) {
  const {
    minRelevanceScore = 0.3,
    validateOptions = true,
    checkAllAbove = true,
    difficulty = 'medium'
  } = options;
  
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return {
      isValid: false,
      validQuestions: [],
      issues: [{ global: 'No questions provided' }],
      metrics: { relevanceScore: 0, difficultyScore: 0 }
    };
  }
  
  const validatedQuestions = [];
  const issues = [];
  let totalRelevanceScore = 0;
  let totalDifficultyScore = 0;
  
  // Process each question
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const validation = validateSingleQuestion(question, sourceContent, { 
      minRelevanceScore, 
      validateOptions,
      checkAllAbove 
    });
    
    // Calculate metrics
    totalRelevanceScore += validation.metrics.relevanceScore;
    totalDifficultyScore += calculateQuestionDifficulty(question, difficulty);
    
    if (validation.isValid) {
      validatedQuestions.push(question);
    } else {
      issues.push({
        questionIndex: i,
        question: question.question,
        issues: validation.issues
      });
    }
  }
  
  // Calculate averages
  const avgRelevanceScore = questions.length > 0 ? totalRelevanceScore / questions.length : 0;
  const avgDifficultyScore = questions.length > 0 ? totalDifficultyScore / questions.length : 0;
  
  return {
    isValid: issues.length === 0,
    validQuestions: validatedQuestions,
    issues,
    metrics: {
      relevanceScore: avgRelevanceScore,
      difficultyScore: avgDifficultyScore,
      averageDifficulty: avgDifficultyScore
    }
  };
}

/**
 * Validate a single question
 * @param {Object} question - Question to validate
 * @param {string} sourceContent - Original source content
 * @param {Object} options - Validation options
 * @returns {Object} - Validation result
 */
function validateSingleQuestion(question, sourceContent, options = {}) {
  const { minRelevanceScore = 0.3, validateOptions = true, checkAllAbove = true } = options;
  const issues = [];
  const metrics = { relevanceScore: 0 };
  
  // Check required fields
  if (!question.question) {
    issues.push('Missing question text');
  }
  
  if (!question.options || !Array.isArray(question.options)) {
    issues.push('Missing or invalid options array');
  } else {
    // Check if we have exactly 5 options after standardization
    if (question.options.length !== 5) {
      issues.push(`Question has ${question.options.length} options, expected 5`);
    }
    
    // Check for empty options
    if (question.options.some(opt => !opt || opt.trim() === '')) {
      issues.push('Contains empty options');
    }
    
    // Validate "All of the above" is the 4th option (index 3)
    if (checkAllAbove && validateOptions) {
      if (question.options[3] !== 'All of the above') {
        issues.push('"All of the above" must be the 4th option');
      }
      
      // Validate "None of the above" is the 5th option (index 4)
      if (question.options[4] !== 'None of the above') {
        issues.push('"None of the above" must be the 5th option');
      }
    }
  }
  
  // Check for valid correctOptionIndex
  if (typeof question.correctOptionIndex !== 'number' || 
      question.correctOptionIndex < 0 || 
      question.correctOptionIndex >= (question.options ? question.options.length : 0)) {
    issues.push('Invalid correctOptionIndex');
  }
  
  // Check question relevance to content
  if (sourceContent && question.question) {
    const relevanceScore = calculateRelevanceScore(question, sourceContent);
    metrics.relevanceScore = relevanceScore;
    
    if (relevanceScore < minRelevanceScore) {
      issues.push(`Low relevance score: ${relevanceScore.toFixed(2)}`);
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    metrics
  };
}

/**
 * Calculate relevance score between question and content
 * @param {Object} question - Question to check
 * @param {string} content - Source content
 * @returns {number} - Relevance score (0-1)
 */
function calculateRelevanceScore(question, content) {
  if (!question || !content) return 0;
  
  // Convert content to lowercase for case-insensitive matching
  const contentLower = content.toLowerCase();
  
  // Extract significant terms from the question (words with 4+ chars)
  const questionText = question.question.toLowerCase();
  const questionTerms = questionText
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length >= 4);
  
  // Extract terms from options
  const optionTerms = question.options
    .slice(0, 3) // Only check the first 3 options (not "all/none of the above")
    .flatMap(opt => 
      opt.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length >= 4)
    );
  
  // Combine unique terms
  const allTerms = [...new Set([...questionTerms, ...optionTerms])];
  
  if (allTerms.length === 0) return 0;
  
  // Count terms found in content
  let matchCount = 0;
  for (const term of allTerms) {
    if (contentLower.includes(term)) {
      matchCount++;
    }
  }
  
  // Calculate score
  return matchCount / allTerms.length;
}

/**
 * Calculate question difficulty (1-5 scale)
 * @param {Object} question - Question to evaluate
 * @param {string} targetDifficulty - Target difficulty level
 * @returns {number} - Difficulty score (1-5)
 */
function calculateQuestionDifficulty(question, targetDifficulty = 'medium') {
  if (!question) return 0;
  
  let baseScore = 3; // Default to medium
  
  // Adjust based on question complexity
  const questionText = question.question.toLowerCase();
  
  // Check for difficulty indicators in the question
  const complexityMarkers = [
    'why', 'how', 'explain', 'compare', 'analyze', 'evaluate', 
    'would', 'could', 'implication', 'significance', 'effect of'
  ];
  
  const simplicityMarkers = [
    'what is', 'who is', 'where is', 'when', 'which of the following', 
    'name the', 'identify'
  ];
  
  // Check for complexity markers
  for (const marker of complexityMarkers) {
    if (questionText.includes(marker)) {
      baseScore += 0.5;
    }
  }
  
  // Check for simplicity markers
  for (const marker of simplicityMarkers) {
    if (questionText.includes(marker)) {
      baseScore -= 0.5;
    }
  }
  
  // Adjust for option length and similarity
  if (question.options && question.options.length >= 3) {
    // Long options tend to be more difficult
    const avgOptionLength = question.options
      .slice(0, 3) // Only consider first 3 options
      .reduce((sum, opt) => sum + opt.length, 0) / 3;
      
    if (avgOptionLength > 30) {
      baseScore += 0.5;
    } else if (avgOptionLength < 10) {
      baseScore -= 0.5;
    }
    
    // Adjust based on target difficulty
    switch (targetDifficulty.toLowerCase()) {
      case 'easy':
        return Math.max(1, Math.min(3, baseScore));
      case 'hard':
        return Math.max(3, Math.min(5, baseScore));
      case 'medium':
      default:
        return Math.max(2, Math.min(4, baseScore));
    }
  }
  
  // Clamp to valid range
  return Math.max(1, Math.min(5, baseScore));
}

module.exports = {
  validateQuiz,
  validateSingleQuestion,
  calculateRelevanceScore,
  calculateQuestionDifficulty
};
