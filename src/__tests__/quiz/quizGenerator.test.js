/**
 * Quiz Generator Unit Tests
 * 
 * Tests the functionality of generating quizzes from URLs
 */

// Mock the content fetcher module
const mockFetch = jest.fn();
jest.mock('../../quiz/contentFetcher', () => ({
  fetchContent: (url) => mockFetch(url)
}));

// Import the module to test (we'll need to create this file later)
const { 
  generateQuiz, 
  generateQuestionsFromContent, 
  validateQuestions 
} = require('../../quiz/quizGenerator');

describe('Quiz Generator', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  // Test URL content extraction
  describe('URL Content Extraction', () => {
    const validUrl = 'https://example.com/article';
    const mockContent = {
      title: 'Test Article',
      text: 'This is a comprehensive article about blockchain technology. It covers topics such as tokens, smart contracts, and decentralized applications.'
    };

    test('should extract content from valid URLs', async () => {
      // Setup mock response
      mockFetch.mockResolvedValueOnce(mockContent);
      
      // Call the function being tested
      const result = await generateQuiz(validUrl);
      
      // Assertions
      expect(mockFetch).toHaveBeenCalledWith(validUrl);
      expect(result).toBeDefined();
      expect(result.sourceUrl).toBe(validUrl);
      expect(result.sourceTitle).toBe(mockContent.title);
      expect(result.questions.length).toBeGreaterThan(0);
    });

    test('should handle invalid URLs gracefully', async () => {
      // Setup mock for invalid URL
      const invalidUrl = 'not-a-url';
      mockFetch.mockRejectedValueOnce(new Error('Invalid URL'));
      
      // Call function with expectation of error
      await expect(generateQuiz(invalidUrl))
        .rejects
        .toThrow('Invalid URL or unable to fetch content');
        
      expect(mockFetch).toHaveBeenCalledWith(invalidUrl);
    });

    test('should handle timeout or network errors', async () => {
      // Setup mock for network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      // Call function with expectation of error
      await expect(generateQuiz(validUrl))
        .rejects
        .toThrow('Invalid URL or unable to fetch content');
        
      expect(mockFetch).toHaveBeenCalledWith(validUrl);
    });
    
    test('should handle empty content gracefully', async () => {
      // Setup mock for empty content
      mockFetch.mockResolvedValueOnce({ title: '', text: '' });
      
      // Call function with expectation of error
      await expect(generateQuiz(validUrl))
        .rejects
        .toThrow('Content too short to generate meaningful quiz');
        
      expect(mockFetch).toHaveBeenCalledWith(validUrl);
    });
  });

  // Test quiz question generation
  describe('Quiz Question Generation', () => {
    const sampleContent = {
      title: 'Blockchain Basics',
      text: 'Blockchain is a distributed ledger technology. It uses cryptography to secure transactions. Smart contracts enable automated execution of agreements.'
    };
    
    test('should generate appropriate questions from extracted content', async () => {
      // Call the function being tested
      const questions = await generateQuestionsFromContent(sampleContent, 3);
      
      // Assertions
      expect(questions).toHaveLength(3);
      questions.forEach(question => {
        expect(question).toHaveProperty('question');
        expect(question).toHaveProperty('options');
        expect(question).toHaveProperty('correctAnswer');
        // The raw questions from the generator will still have the original options 
        // (before standardization to 5 options in the UI)
        expect(question.options.length).toBeGreaterThan(0);
        expect(question.options).toContain(question.correctAnswer);
      });
    });

    test('should create multi-choice questions with one correct answer', async () => {
      // Call the function being tested
      const questions = await generateQuestionsFromContent(sampleContent, 1);
      
      // Assertions
      expect(questions).toHaveLength(1);
      
      const question = questions[0];
      expect(question.options.length).toBeGreaterThan(0);
      
      // The correct answer should be one of the options
      expect(question.options.includes(question.correctAnswer)).toBe(true);
      
      // Only one answer should be correct
      const correctOptions = question.options.filter(opt => opt === question.correctAnswer);
      expect(correctOptions).toHaveLength(1);
    });

    test('should generate specified number of questions', async () => {
      // Test with different question counts
      const counts = [1, 3, 5];
      
      for (const count of counts) {
        const questions = await generateQuestionsFromContent(sampleContent, count);
        expect(questions).toHaveLength(count);
      }
    });
    
    test('should throw error when content is insufficient for requested questions', async () => {
      // Content too short for many questions
      const shortContent = {
        title: 'Short',
        text: 'Very brief text.'
      };
      
      await expect(generateQuestionsFromContent(shortContent, 10))
        .rejects
        .toThrow('Content too short to generate requested number of questions');
    });
  });

  // Test for quiz difficulty and quality
  describe('Quiz Quality', () => {
    const complexContent = {
      title: 'Complex Blockchain Technology',
      text: 'Blockchain employs cryptographic hashing functions to ensure data integrity. Zero-knowledge proofs allow for verification without revealing the underlying data. Layer 2 scaling solutions address transaction throughput limitations.'
    };
    
    test('should create questions of appropriate difficulty', async () => {
      // Generate questions from complex content
      const questions = await generateQuestionsFromContent(complexContent, 3);
      
      // Validate questions for complexity
      const validationResult = validateQuestions(questions, 'medium');
      
      expect(validationResult.valid).toBe(true);
      expect(validationResult.averageDifficulty).toBeGreaterThanOrEqual(2); // Medium difficulty
      expect(validationResult.averageDifficulty).toBeLessThanOrEqual(4); // Medium difficulty
    });

    test('should not repeat the same questions', async () => {
      // Generate multiple sets of questions from the same content
      const firstSet = await generateQuestionsFromContent(complexContent, 5);
      const secondSet = await generateQuestionsFromContent(complexContent, 5);
      
      // Extract just the question text for comparison
      const firstQuestions = firstSet.map(q => q.question);
      const secondQuestions = secondSet.map(q => q.question);
      
      // Check for duplicates within same set
      const uniqueFirstQuestions = new Set(firstQuestions);
      expect(uniqueFirstQuestions.size).toBe(firstQuestions.length);
      
      // Check for overlap between sets (some overlap is acceptable, but not complete duplication)
      const overlappingQuestions = firstQuestions.filter(q => secondQuestions.includes(q));
      expect(overlappingQuestions.length).toBeLessThan(firstQuestions.length / 2);
    });
    
    test('should generate contextually relevant questions', async () => {
      const bitcoinContent = {
        title: 'Bitcoin Whitepaper',
        text: 'Bitcoin is a peer-to-peer electronic cash system that enables online payments to be sent directly from one party to another without going through a financial institution. The network timestamps transactions by hashing them into an ongoing chain of hash-based proof-of-work.'
      };
      
      const questions = await generateQuestionsFromContent(bitcoinContent, 2);
      
      // Questions should contain relevant keywords from the content
      const relevantTerms = ['Bitcoin', 'peer-to-peer', 'electronic cash', 'transactions', 'hash'];
      
      questions.forEach(question => {
        const hasRelevantTerms = relevantTerms.some(term => 
          question.question.includes(term) || 
          question.options.some(opt => opt.includes(term))
        );
        
        expect(hasRelevantTerms).toBe(true);
      });
    });
  });
});

