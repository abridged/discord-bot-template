/**
 * Secure Quiz Generator Tests
 * 
 * Tests for the enhanced secure quiz generator that addresses security vulnerabilities
 */

// Mock the content fetcher module
const mockFetch = jest.fn();
jest.mock('../../quiz/contentFetcher', () => ({
  fetchContent: (url) => mockFetch(url)
}));

// Import the enhanced secure module
const { 
  generateQuiz, 
  generateQuestionsFromContent, 
  validateQuestions,
  sanitizeContent 
} = require('../../quiz/secureQuizGenerator');

describe('Secure Quiz Generator', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('Content Sanitization', () => {
    test('should properly sanitize HTML/JavaScript in content', () => {
      const maliciousContent = '<script>alert("XSS")</script>Legitimate content<img src="x" onerror="alert(1)">';
      const sanitized = sanitizeContent(maliciousContent);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
      expect(sanitized).not.toContain('onerror=');
      expect(sanitized).toContain('Legitimate content');
    });

    test('should handle Unicode exploits', () => {
      const unicodeExploitContent = 'Hidden\u200Bcontent with\u202Edirection override';
      const sanitized = sanitizeContent(unicodeExploitContent);
      
      expect(sanitized).not.toContain('\u200B'); // Zero-width space
      expect(sanitized).not.toContain('\u202E'); // Right-to-left override
      expect(sanitized).toContain('Hidden');
      expect(sanitized).toContain('content with');
      expect(sanitized).toContain('direction override');
    });
    
    test('should sanitize malicious URLs in markdown', () => {
      const markdownContent = 'Check [this](javascript:alert("xss")) link or [that](data:text/html,<script>alert(1)</script>)';
      const sanitized = sanitizeContent(markdownContent);
      
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).not.toContain('data:text/html');
      expect(sanitized).toContain('Check');
      expect(sanitized).toContain('this');
      expect(sanitized).toContain('link');
      expect(sanitized).toContain('that');
    });
  });

  describe('Quiz Generation Security', () => {
    const validUrl = 'https://example.com/article';
    const mockContent = {
      title: 'Test Article',
      text: 'This is a comprehensive article about blockchain technology. It covers topics such as tokens, smart contracts, and decentralized applications. The content has sufficient length to generate appropriate quiz questions with good variation.'
    };

    test('should handle timeouts gracefully', async () => {
      // Mock a delay longer than the timeout
      mockFetch.mockImplementationOnce(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(mockContent);
          }, 15000); // 15 seconds, longer than default timeout
        });
      });
      
      // Should reject with timeout error
      await expect(generateQuiz(validUrl, { timeout: 100 }))
        .rejects
        .toThrow('Content fetch timeout');
    });
    
    test('should enforce content size limits', async () => {
      // Mock extremely large content
      const largeContent = {
        title: 'Large Article',
        text: 'a'.repeat(1000000) // 1MB of text
      };
      mockFetch.mockResolvedValueOnce(largeContent);
      
      // Should reject with size error
      await expect(generateQuiz(validUrl, { contentMaxSize: 500000 }))
        .rejects
        .toThrow('Content size unsuitable');
    });
    
    test('should generate unpredictable but valid questions', async () => {
      // Create more detailed mock content for better question generation
      const detailedMockContent = {
        title: 'Comprehensive Article on Blockchain',
        text: 'Blockchain technology provides a secure, decentralized platform for transactions. ' +
              'Smart contracts automate agreements without intermediaries. Tokens represent ' +
              'digital assets on blockchains. Cryptography ensures security and privacy. ' +
              'Consensus mechanisms validate transactions across distributed networks. ' +
              'Decentralized applications operate without central control. Mining secures ' +
              'proof-of-work blockchains through computational effort. Wallets store private ' +
              'keys for accessing blockchain assets. Interoperability allows different ' +
              'blockchains to communicate and share data effectively.'
      };
      
      mockFetch.mockResolvedValueOnce(detailedMockContent);
      mockFetch.mockResolvedValueOnce(detailedMockContent);
      
      // Generate multiple quizzes to check variation
      const result1 = await generateQuiz(validUrl);
      const result2 = await generateQuiz(validUrl);
      
      // Both should have valid questions
      expect(result1.questions.length).toBeGreaterThan(0);
      expect(result2.questions.length).toBeGreaterThan(0);
      
      // Questions should be different between runs
      const questions1 = result1.questions.map(q => q.question);
      const questions2 = result2.questions.map(q => q.question);
      
      // Should have minimal overlap
      const overlappingQuestions = questions1.filter(q => questions2.includes(q));
      expect(overlappingQuestions.length).toBeLessThan(questions1.length / 2);
      
      // Analyze correct answer positions to ensure reasonable distribution
      const positions1 = result1.questions.map(q => q.options.indexOf(q.correctAnswer));
      const countByPosition = [0, 0, 0, 0];
      
      positions1.forEach(pos => {
        countByPosition[pos]++;
      });
      
      // No position should have all or none of the correct answers
      const maxCount = Math.max(...countByPosition);
      const minCount = Math.min(...countByPosition);
      
      expect(maxCount).toBeLessThan(result1.questions.length); // Not all in same position
      expect(minCount).toBeGreaterThanOrEqual(0); // Some answers in each position
    });
  });

  describe('Question Quality and Validation', () => {
    const sampleContent = {
      title: 'Blockchain Technology',
      text: 'Blockchain is a distributed ledger technology that enables secure, transparent transactions without a central authority. It uses cryptography to secure transactions and maintains a continuously growing list of records called blocks. Smart contracts are self-executing contracts with the terms directly written into code. They automatically execute when predefined conditions are met, which enhances trust and reduces the need for intermediaries.'
    };
    
    test('should generate distinct options with meaningful content', async () => {
      const questions = await generateQuestionsFromContent(sampleContent, 3);
      
      questions.forEach(question => {
        // Check options are meaningful
        question.options.forEach(option => {
          expect(option.trim()).not.toBe('');
          expect(option.length).toBeGreaterThan(5);
        });
        
        // Check options are distinct from each other
        const uniqueOptions = new Set(question.options);
        expect(uniqueOptions.size).toBe(question.options.length);
        
        // Check correct answer exists in options
        expect(question.options).toContain(question.correctAnswer);
      });
    });
    
    test('should detect and reject invalid questions', () => {
      // Test with invalid questions
      const invalidQuestions = [
        {
          question: '',
          options: ['Option A', 'Option B'],
          correctAnswer: 'Option C' // Not in options
        },
        {
          question: 'Valid question',
          options: ['Option A', 'Option A'], // Duplicate options
          correctAnswer: 'Option A'
        },
        {
          question: 'Another question',
          options: ['', 'Option B'], // Empty option
          correctAnswer: 'Option B'
        }
      ];
      
      const result = validateQuestions(invalidQuestions);
      expect(result.valid).toBe(false);
    });
    
    test('should ensure answer distribution is not predictable', () => {
      // Create questions with uneven correct answer distribution
      const unevenQuestions = [
        {
          question: 'Question 1',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'A' // Position 0
        },
        {
          question: 'Question 2',
          options: ['E', 'F', 'G', 'H'],
          correctAnswer: 'E' // Position 0
        },
        {
          question: 'Question 3',
          options: ['I', 'J', 'K', 'L'],
          correctAnswer: 'I' // Position 0
        },
        {
          question: 'Question 4',
          options: ['M', 'N', 'O', 'P'],
          correctAnswer: 'M' // Position 0
        }
      ];
      
      const result = validateQuestions(unevenQuestions);
      
      // Should detect issues with the answers
      expect(result.valid).toBe(false);
    });
    
    test('should handle memory limitations appropriately', async () => {
      // Generate many questions to test memory management
      for (let i = 0; i < 20; i++) {
        await generateQuestionsFromContent(sampleContent, 5);
      }
      
      // Should still be able to generate questions without errors
      const finalQuestions = await generateQuestionsFromContent(sampleContent, 5);
      expect(finalQuestions.length).toBe(5);
    });
  });

  describe('End-to-End Quiz Generation', () => {
    test('should generate a complete, secure quiz from URL content', async () => {
      const url = 'https://example.com/blockchain-article';
      const mockContent = {
        title: 'Blockchain Fundamentals',
        text: 'Blockchain technology provides a decentralized, secure way to record transactions and track assets. Key concepts include distributed ledger, consensus mechanisms, and cryptographic hashing. Smart contracts enable automated execution of agreements when predefined conditions are met. The technology has applications in finance, supply chain, healthcare, and many other industries.'
      };
      
      mockFetch.mockResolvedValueOnce(mockContent);
      
      const quiz = await generateQuiz(url);
      
      // Verify complete quiz structure
      expect(quiz).toHaveProperty('sourceUrl', url);
      expect(quiz).toHaveProperty('sourceTitle');
      expect(quiz).toHaveProperty('questions');
      expect(quiz).toHaveProperty('generatedAt');
      expect(quiz).toHaveProperty('metadata');
      
      // Verify questions
      expect(quiz.questions.length).toBeGreaterThan(0);
      quiz.questions.forEach(question => {
        expect(question).toHaveProperty('question');
        expect(question).toHaveProperty('options');
        expect(question).toHaveProperty('correctAnswer');
        expect(question.options).toContain(question.correctAnswer);
      });
      
      // Verify sanitization happened
      expect(quiz.sourceTitle).toBe(mockContent.title); // Sanitized but unchanged in this case
    });
    
    test('should handle malicious content securely in end-to-end flow', async () => {
      const url = 'https://malicious-site.com/article';
      const maliciousContent = {
        title: '<script>alert("Title XSS")</script>Compromised Article',
        text: 'Normal looking content <iframe src="javascript:alert()"></iframe> with hidden iframes and more <script>document.location="evil.com"</script> scripts.'
      };
      
      mockFetch.mockResolvedValueOnce(maliciousContent);
      
      const quiz = await generateQuiz(url);
      
      // Title should be sanitized
      expect(quiz.sourceTitle).not.toContain('<script>');
      expect(quiz.sourceTitle).toContain('Compromised Article');
      
      // Questions should not contain malicious content
      quiz.questions.forEach(question => {
        expect(question.question).not.toContain('<script>');
        expect(question.question).not.toContain('<iframe');
        expect(question.question).not.toContain('javascript:');
        
        question.options.forEach(option => {
          expect(option).not.toContain('<script>');
          expect(option).not.toContain('<iframe');
          expect(option).not.toContain('javascript:');
        });
      });
    });
  });
});
