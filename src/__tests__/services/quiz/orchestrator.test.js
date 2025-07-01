/**
 * Quiz Orchestration Service Tests
 */

// Mock all dependencies for deterministic tests
jest.mock('../../../services/content');
jest.mock('../../../services/llm');
jest.mock('../../../services/validation');

// Import the module and mocked dependencies after mocking
const { createQuizFromUrl } = require('../../../services/quiz/orchestrator');
const { extractContentFromURL } = require('../../../services/content');
const { generateQuestionsFromContent } = require('../../../services/llm');
const { validateQuiz } = require('../../../services/validation');

// Mock questions data
const mockQuestions = [
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
];

describe('Quiz Orchestration Service', () => {
  // Save original console methods
  const originalConsole = { ...console };
  
  // Setup and teardown
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console methods to prevent them from affecting test output
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    
    // Default mock implementations for successful path
    extractContentFromURL.mockResolvedValue({
      title: 'Test Article',
      text: 'This is test content for quiz generation.'
    });
    
    generateQuestionsFromContent.mockResolvedValue(mockQuestions);
    
    validateQuiz.mockReturnValue({
      isValid: true,
      validQuestions: mockQuestions,
      issues: [],
      metrics: {
        relevanceScore: 0.9,
        difficultyScore: 2.5
      }
    });
  });
  
  // Restore console methods after each test
  afterEach(() => {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });
  
  test('should create a quiz from a URL through the entire pipeline', async () => {
    const url = 'https://example.com/test-article';
    const options = {
      numQuestions: 3,
      difficulty: 'medium'
    };
    
    const quiz = await createQuizFromUrl(url, options);
    
    // Verify content extraction was called
    expect(extractContentFromURL).toHaveBeenCalledWith(url);
    
    // Verify question generation was called with correct parameters
    expect(generateQuestionsFromContent).toHaveBeenCalledWith(
      {title: 'Test Article', text: 'This is test content for quiz generation.'}, 
      {numQuestions: 3, difficulty: 'medium', temperature: expect.any(Number)}
    );
    
    // Verify validation was called
    expect(validateQuiz).toHaveBeenCalled();
    
    // Verify quiz structure
    expect(quiz).toHaveProperty('sourceUrl', url);
    expect(quiz).toHaveProperty('sourceTitle', 'Test Article');
    expect(quiz).toHaveProperty('questions');
    expect(quiz.questions).toHaveLength(2); // Our mock returns 2 questions
    expect(quiz).toHaveProperty('metadata');
    expect(quiz.metadata).toHaveProperty('validationMetrics');
    expect(quiz.metadata).toHaveProperty('validationPassed', true);
  });
  
  test('should handle errors in the pipeline', async () => {
    // Mock failure in content extraction
    extractContentFromURL.mockImplementation(() => {
      throw new Error('Failed to extract content');
    });
    
    const url = 'https://example.com/broken-url';
    
    // Test that the function properly rejects with the expected error
    await expect(createQuizFromUrl(url)).rejects.toThrow(/Failed to create quiz/);
    
    // Verify content extraction was called
    expect(extractContentFromURL).toHaveBeenCalledWith(url);
    
    // Verify question generation was not called
    expect(generateQuestionsFromContent).not.toHaveBeenCalled();
  });
  
  test('should handle validation issues but still produce a quiz', async () => {
    // Setup specific mock for validation issues case
    validateQuiz.mockReturnValueOnce({
      isValid: false,  // Set validation to fail
      validQuestions: [{
        question: "Test question 1?",
        options: ["Option A", "Option B", "Option C", "All of the above", "None of the above"],
        correctOptionIndex: 0
      }], // Return only the first question as valid
      issues: [{ 
        questionIndex: 1,
        question: "Test question 2?",
        issues: ['Irrelevant to content'] 
      }],
      metrics: {
        relevanceScore: 0.6,
        difficultyScore: 2.0
      }
    });
    
    const url = 'https://example.com/test-article';
    const quiz = await createQuizFromUrl(url);
    
    // Verify we still get a quiz despite validation issues
    expect(quiz).toBeDefined();
    expect(quiz).toHaveProperty('questions');
    // The orchestrator should still create a quiz with at least the valid question
    expect(quiz.questions.length).toBe(1); // Only one valid question
    expect(quiz.metadata.validationPassed).toBe(false);
  });
  
  test('should handle errors in the pipeline', async () => {
    // Setup mock for error case
    extractContentFromURL.mockRejectedValueOnce(new Error('Failed to extract content'));
    
    const url = 'https://example.com/broken-url';
    
    // Test that the function properly rejects with the expected error
    await expect(createQuizFromUrl(url)).rejects.toThrow(/Failed to create quiz/);
    
    // Verify content extraction was called
    expect(extractContentFromURL).toHaveBeenCalledWith(url);
    
    // Verify question generation was not called
    expect(generateQuestionsFromContent).not.toHaveBeenCalled();
  });
});
