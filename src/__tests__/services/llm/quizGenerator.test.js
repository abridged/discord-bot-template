/**
 * LLM Service - Quiz Generator Tests
 */

// Mock the OpenAI API
jest.mock('openai', () => {
  const mockOpenAIApi = {
    createChatCompletion: jest.fn(() => Promise.resolve({
      data: {
        choices: [{
          message: {
            content: JSON.stringify([
              {
                question: "What is the main purpose of blockchain technology?",
                options: ["Decentralized record keeping", "Password security", "Web browsing"],
                correctOptionIndex: 0
              },
              {
                question: "What makes blockchain secure?",
                options: ["Cryptographic hashing", "Government oversight", "Anti-virus software"],
                correctOptionIndex: 0
              }
            ])
          }
        }]
      }
    }))
  };
  
  return {
    Configuration: jest.fn(),
    OpenAIApi: jest.fn(() => mockOpenAIApi)
  };
});

// Mock the content service
jest.mock('../../../services/content', () => ({
  extractContentFromURL: jest.fn(() => Promise.resolve({
    title: 'Test Article About Blockchain',
    text: `Blockchain technology is a decentralized, distributed ledger that records transactions across multiple computers. 
    The use of blockchain ensures that the transaction record is immutable and transparent. It works by creating 
    blocks of data that are chained together using cryptographic principles.
    
    Each block contains a cryptographic hash of the previous block, transaction data, and a timestamp. This structure 
    inherently makes blockchain resistant to modification of the data. Once recorded, the data in any block cannot be 
    altered retroactively without altering all subsequent blocks, which requires consensus of the network majority.
    
    Blockchain technology was originally created for Bitcoin, but has since found applications in supply chain tracking, 
    voting systems, identity management, and smart contracts among many other uses. Its decentralized nature eliminates 
    the need for central authorities and reduces the risk of single points of failure.`
  }))
}));

const { 
  generateQuestionsFromContent,
  generateQuiz,
  standardizeQuestions
} = require('../../../services/llm/quizGenerator');

describe('LLM Quiz Generator', () => {
  // Store original env vars and reset after tests
  const originalEnv = process.env;
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Set mock API key for tests
    process.env.OPENAI_API_KEY = 'test-api-key';
  });
  
  afterEach(() => {
    // Restore original env vars
    process.env = originalEnv;
  });
  
  describe('Question Generation', () => {
    test('should generate questions from content', async () => {
      // Create content that's long enough to pass the length check (500 chars per question * 2 questions)
      const content = {
        title: 'Test Article',
        text: `Blockchain technology is a decentralized, distributed ledger that records transactions across multiple computers. 
        The use of blockchain ensures that the transaction record is immutable and transparent. It works by creating 
        blocks of data that are chained together using cryptographic principles.
        
        Each block contains a cryptographic hash of the previous block, transaction data, and a timestamp. This structure 
        inherently makes blockchain resistant to modification of the data. Once recorded, the data in any block cannot be 
        altered retroactively without altering all subsequent blocks, which requires consensus of the network majority.
        
        Blockchain technology was originally created for Bitcoin, but has since found applications in supply chain tracking, 
        voting systems, identity management, and smart contracts among many other uses. Its decentralized nature eliminates 
        the need for central authorities and reduces the risk of single points of failure.`
      };
      
      const result = await generateQuestionsFromContent(content, { numQuestions: 2 });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBeTruthy();
      expect(result.length).toBe(2);
      
      // Check question structure
      const question = result[0];
      expect(question).toHaveProperty('question');
      expect(question).toHaveProperty('options');
      expect(question).toHaveProperty('correctOptionIndex');
      
      // Check standardization to 5 options
      expect(question.options.length).toBe(5);
      expect(question.options[3]).toBe('All of the above');
      expect(question.options[4]).toBe('None of the above');
    });
    
    test('should handle insufficient content', async () => {
      const content = {
        title: 'Short',
        text: 'Too short.'
      };
      
      await expect(generateQuestionsFromContent(content, { numQuestions: 5 }))
        .rejects.toThrow('Content too short to generate requested number of questions');
    });
  });
  
  describe('Quiz Generation from URL', () => {
    test('should generate a complete quiz from a URL', async () => {
      const url = 'https://example.com/article';
      
      // The test will receive 2 questions because our mock is configured to return 2 questions
      const result = await generateQuiz(url, { numQuestions: 1 });
      
      expect(result).toHaveProperty('sourceUrl', url);
      expect(result).toHaveProperty('sourceTitle', 'Test Article About Blockchain');
      expect(result).toHaveProperty('questions');
      expect(result.questions.length).toBe(2);
    });
  });
  
  describe('Question Standardization', () => {
    test('should standardize questions to 5-option format', () => {
      const rawQuestions = [
        {
          question: "What is X?",
          options: ["Option A", "Option B"],
          correctOptionIndex: 0
        }
      ];
      
      const standardized = standardizeQuestions(rawQuestions);
      
      expect(standardized[0].options.length).toBe(5);
      expect(standardized[0].options[0]).toBe('Option A');
      expect(standardized[0].options[1]).toBe('Option B');
      expect(standardized[0].options[2]).toBe('Option 3');
      expect(standardized[0].options[3]).toBe('All of the above');
      expect(standardized[0].options[4]).toBe('None of the above');
      expect(standardized[0].correctOptionIndex).toBe(0);
    });
    
    test('should handle question with missing correct answer', () => {
      const rawQuestions = [
        {
          question: "Broken question?",
          options: ["Option A", "Option B"],
          correctOptionIndex: 5 // Out of bounds
        }
      ];
      
      const standardized = standardizeQuestions(rawQuestions);
      // Should default to first option when correct answer is missing
      expect(standardized[0].correctOptionIndex).toBe(0);
    });
  });
});
