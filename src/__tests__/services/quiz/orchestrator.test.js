/**
 * Quiz Orchestration Service Tests
 */

// Mock the content service
jest.mock('../../../services/content', () => ({
  extractContentFromURL: jest.fn(() => Promise.resolve({
    title: 'Test Article',
    text: 'This is test content for quiz generation.'
  }))
}));

// Mock the LLM service
jest.mock('../../../services/llm', () => ({
  generateQuestionsFromContent: jest.fn(() => Promise.resolve([
    {
      question: "Test question 1?",
      options: ["Option A", "Option B", "Option C", "All of the above", "None of the above"],
      correctOptionIndex: 0
    },
    {
      question: "Test question 2?",
      options: ["Option X", "Option Y", "Option Z", "All of the above", "None of the above"],
      correctOptionIndex: 1
    }
  ]))
}));

// Mock the validation service
jest.mock('../../../services/validation', () => ({
  validateQuiz: jest.fn(() => ({
    isValid: true,
    validQuestions: [
      {
        question: "Test question 1?",
        options: ["Option A", "Option B", "Option C", "All of the above", "None of the above"],
        correctOptionIndex: 0
      },
      {
        question: "Test question 2?",
        options: ["Option X", "Option Y", "Option Z", "All of the above", "None of the above"],
        correctOptionIndex: 1
      }
    ],
    issues: [],
    metrics: {
      relevanceScore: 0.8,
      difficultyScore: 2.5
    }
  }))
}));

const { createQuizFromUrl } = require('../../../services/quiz/orchestrator');
const { extractContentFromURL } = require('../../../services/content');
const { generateQuestionsFromContent } = require('../../../services/llm');
const { validateQuiz } = require('../../../services/validation');

describe('Quiz Orchestration Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('should create a quiz from a URL through the entire pipeline', async () => {
    const url = 'https://example.com/test-article';
    const options = {
      numQuestions: 2,
      difficulty: 'medium'
    };
    
    const quiz = await createQuizFromUrl(url, options);
    
    // Verify content extraction was called
    expect(extractContentFromURL).toHaveBeenCalledWith(url);
    
    // Verify question generation was called with correct parameters
    expect(generateQuestionsFromContent).toHaveBeenCalledWith(
      {title: 'Test Article', text: 'This is test content for quiz generation.'}, 
      {numQuestions: 2, difficulty: 'medium', temperature: expect.any(Number)}
    );
    
    // Verify validation was called
    expect(validateQuiz).toHaveBeenCalled();
    
    // Verify quiz structure
    expect(quiz).toHaveProperty('sourceUrl', url);
    expect(quiz).toHaveProperty('sourceTitle', 'Test Article');
    expect(quiz).toHaveProperty('questions');
    expect(quiz.questions).toHaveLength(2);
    expect(quiz).toHaveProperty('metadata');
    expect(quiz.metadata).toHaveProperty('validationMetrics');
    expect(quiz.metadata).toHaveProperty('validationPassed', true);
  });
  
  test('should handle errors in the pipeline', async () => {
    // Mock failure in content extraction
    extractContentFromURL.mockImplementationOnce(() => 
      Promise.reject(new Error('Failed to extract content'))
    );
    
    const url = 'https://example.com/broken-url';
    
    await expect(createQuizFromUrl(url)).rejects.toThrow('Failed to create quiz');
    
    // Verify content extraction was called
    expect(extractContentFromURL).toHaveBeenCalledWith(url);
    
    // Verify question generation was not called
    expect(generateQuestionsFromContent).not.toHaveBeenCalled();
  });
  
  test('should handle validation issues but still produce a quiz', async () => {
    // Mock validation issues
    validateQuiz.mockImplementationOnce(() => ({
      isValid: false,
      validQuestions: [
        {
          question: "Test question 1?",
          options: ["Option A", "Option B", "Option C", "All of the above", "None of the above"],
          correctOptionIndex: 0
        }
      ],
      issues: [
        { 
          questionIndex: 1,
          question: "Test question 2?",
          issues: ['Irrelevant to content'] 
        }
      ],
      metrics: {
        relevanceScore: 0.6,
        difficultyScore: 2.0
      }
    }));
    
    const url = 'https://example.com/test-article';
    const quiz = await createQuizFromUrl(url);
    
    // Verify we still get a quiz despite validation issues
    expect(quiz).toBeDefined();
    expect(quiz.questions).toHaveLength(1); // Only the valid question
    expect(quiz.metadata.validationPassed).toBe(false);
  });
});
