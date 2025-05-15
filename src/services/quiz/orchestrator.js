/**
 * Quiz Orchestration Service
 * Coordinates interactions between content extraction, LLM generation, and validation services
 */

const { extractContentFromURL } = require('../content');
const { generateQuiz, generateQuestionsFromContent } = require('../llm');
const { validateQuiz } = require('../validation');

/**
 * Create a quiz from a URL through the entire pipeline
 * @param {string} url - URL to create quiz from
 * @param {Object} options - Options for quiz generation
 * @returns {Promise<Object>} - Complete quiz data
 */
async function createQuizFromUrl(url, options = {}) {
  try {
    console.log(`Creating quiz from URL: ${url}`);
    
    // Extract content from URL
    console.log('Extracting content...');
    const contentObj = await extractContentFromURL(url);
    
    // Generate questions from content
    console.log('Generating questions...');
    const rawQuestions = await generateQuestionsFromContent(contentObj, {
      numQuestions: options.numQuestions || 3,
      difficulty: options.difficulty || 'medium',
      temperature: options.temperature || 0.7
    });
    
    // Validate generated questions
    console.log('Validating questions...');
    const validationResult = validateQuiz(rawQuestions, contentObj.text, {
      minRelevanceScore: options.minRelevanceScore || 0.3,
      difficulty: options.difficulty || 'medium'
    });
    
    // Log validation issues if any
    if (validationResult.issues.length > 0) {
      console.warn(`Validation found ${validationResult.issues.length} issues:`, validationResult.issues);
    }
    
    // Use validated questions or fall back to raw questions
    const finalQuestions = validationResult.validQuestions.length > 0 
      ? validationResult.validQuestions 
      : rawQuestions;
    
    // Create the final quiz object
    const quiz = {
      sourceUrl: url,
      sourceTitle: contentObj.title,
      questions: finalQuestions,
      metadata: {
        generationDate: new Date().toISOString(),
        validationMetrics: validationResult.metrics,
        validationPassed: validationResult.isValid
      }
    };
    
    // Log the entire quiz question data to help with debugging
    console.log(`Quiz created with ${quiz.questions.length} questions`);
    console.log('QUIZ QUESTIONS DATA:', JSON.stringify(quiz.questions, null, 2));
    
    // Verify that each question has proper options
    quiz.questions.forEach((q, index) => {
      console.log(`Question ${index + 1}:`, q.question);
      console.log(`Options:`, q.options);
      console.log(`Correct Answer Index:`, q.correctOptionIndex);
      
      // Verify options are not generic placeholders
      const genericOptions = q.options.filter(opt => /^Option [A-Z0-9]$/i.test(opt.trim()));
      if (genericOptions.length > 0) {
        console.warn(`WARNING: Question ${index + 1} has ${genericOptions.length} generic options!`);
      }
    });
    return quiz;
  } catch (error) {
    console.error('Error in quiz creation pipeline:', error);
    throw new Error(`Failed to create quiz: ${error.message}`);
  }
}

module.exports = {
  createQuizFromUrl
};
