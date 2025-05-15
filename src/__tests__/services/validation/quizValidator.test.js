/**
 * Quiz Validation Service Tests
 */

const { 
  validateQuiz,
  validateSingleQuestion,
  calculateRelevanceScore,
  calculateQuestionDifficulty
} = require('../../../services/validation/quizValidator');

describe('Quiz Validation Service', () => {
  describe('Quiz Validation', () => {
    test('should validate a well-formed quiz', () => {
      const questions = [
        {
          question: "What is blockchain technology?",
          options: [
            "A distributed ledger technology", 
            "A type of cryptocurrency", 
            "A programming language",
            "All of the above",
            "None of the above"
          ],
          correctOptionIndex: 0
        },
        {
          question: "What is a smart contract?",
          options: [
            "Self-executing code on a blockchain", 
            "A legal document", 
            "A type of cryptocurrency wallet",
            "All of the above",
            "None of the above"
          ],
          correctOptionIndex: 0
        }
      ];
      
      const content = "Blockchain is a distributed ledger technology that allows data to be stored across a network of computers. Smart contracts are self-executing code that run on blockchain platforms.";
      
      const result = validateQuiz(questions, content);
      
      expect(result.isValid).toBe(true);
      expect(result.validQuestions).toHaveLength(2);
      expect(result.issues).toHaveLength(0);
    });
    
    test('should identify issues with invalid questions', () => {
      const invalidQuestions = [
        {
          question: "What is blockchain?",
          options: [
            "A distributed ledger", 
            "A cryptocurrency", 
            "A programming language",
            "Something else", // Wrong format - should be "All of the above"
            "None of the above"
          ],
          correctOptionIndex: 0
        },
        {
          question: "", // Empty question
          options: [
            "Option A", 
            "Option B", 
            "Option C",
            "All of the above",
            "None of the above"
          ],
          correctOptionIndex: 0
        }
      ];
      
      const content = "Blockchain technology content here.";
      
      const result = validateQuiz(invalidQuestions, content);
      
      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      // First question has format issue with "All of the above"
      expect(result.issues[0].issues.some(issue => issue.includes('All of the above'))).toBe(true);
      // Second question has empty question text
      expect(result.issues[1].issues.some(issue => issue.includes('Missing question text'))).toBe(true);
    });
    
    test('should identify irrelevant questions', () => {
      const questions = [
        {
          question: "What is quantum computing?", // Irrelevant to content
          options: [
            "Computing using quantum mechanics", 
            "Classical computing", 
            "Cloud computing",
            "All of the above",
            "None of the above"
          ],
          correctOptionIndex: 0
        }
      ];
      
      const content = "Blockchain is a distributed ledger technology."; // No mention of quantum computing
      
      const result = validateQuiz(questions, content, { minRelevanceScore: 0.5 });
      
      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBe(1);
      expect(result.issues[0].issues.some(issue => issue.includes('relevance'))).toBe(true);
    });
  });
  
  describe('Question Validation', () => {
    test('should validate a well-formed question', () => {
      const question = {
        question: "What is blockchain?",
        options: [
          "Distributed ledger", 
          "Database", 
          "File system",
          "All of the above",
          "None of the above"
        ],
        correctOptionIndex: 0
      };
      
      const content = "Blockchain is a type of distributed ledger.";
      
      const result = validateSingleQuestion(question, content);
      
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
    
    test('should identify missing required fields', () => {
      const incompleteQuestion = {
        options: ["A", "B", "C", "All of the above", "None of the above"],
        correctOptionIndex: 0
        // Missing question text
      };
      
      const result = validateSingleQuestion(incompleteQuestion, '');
      
      expect(result.isValid).toBe(false);
      expect(result.issues.some(issue => issue.includes('Missing question text'))).toBe(true);
    });
    
    test('should validate standardized 5-option format', () => {
      const incorrectFormatQuestion = {
        question: "Test question?",
        options: ["A", "B", "C", "D"], // Missing 5th option
        correctOptionIndex: 0
      };
      
      const result = validateSingleQuestion(incorrectFormatQuestion, '');
      
      expect(result.isValid).toBe(false);
      expect(result.issues.some(issue => issue.includes('expected 5'))).toBe(true);
    });
    
    test('should verify "All of the above" is the 4th option', () => {
      const incorrectOrderQuestion = {
        question: "Test question?",
        options: ["A", "B", "C", "None of the above", "All of the above"], // Wrong order
        correctOptionIndex: 0
      };
      
      const result = validateSingleQuestion(incorrectOrderQuestion, '');
      
      expect(result.isValid).toBe(false);
      expect(result.issues.some(issue => issue.includes('All of the above'))).toBe(true);
    });
  });
  
  describe('Relevance Calculation', () => {
    test('should calculate high relevance for related questions', () => {
      const question = {
        question: "What is blockchain technology?",
        options: ["Distributed ledger", "Database", "Network"]
      };
      
      const content = "Blockchain technology is a distributed ledger system that enables secure, transparent transactions.";
      
      const score = calculateRelevanceScore(question, content);
      
      expect(score).toBeGreaterThan(0.5); // High relevance expected
    });
    
    test('should calculate low relevance for unrelated questions', () => {
      const question = {
        question: "What is quantum computing?",
        options: ["Quantum mechanics", "Computing", "Entanglement"]
      };
      
      const content = "Blockchain technology is a distributed ledger system."; // No quantum computing content
      
      const score = calculateRelevanceScore(question, content);
      
      expect(score).toBeLessThan(0.5); // Low relevance expected
    });
  });
  
  describe('Question Difficulty Calculation', () => {
    test('should identify easy questions', () => {
      const easyQuestion = {
        question: "What is the name of this technology?",
        options: ["Blockchain", "Database", "Internet"]
      };
      
      const score = calculateQuestionDifficulty(easyQuestion, 'easy');
      
      expect(score).toBeLessThanOrEqual(3); // Easy to medium
    });
    
    test('should identify difficult questions', () => {
      const hardQuestion = {
        question: "How would the implementation of zero-knowledge proofs affect the scalability and privacy trade-offs in blockchain systems?",
        options: [
          "Comprehensive analysis of trade-offs", 
          "Technical implementation details", 
          "Mathematical foundations"
        ]
      };
      
      const score = calculateQuestionDifficulty(hardQuestion, 'hard');
      
      expect(score).toBeGreaterThanOrEqual(3); // Medium to hard
    });
  });
});
