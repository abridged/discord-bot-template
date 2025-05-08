# Quiz Generator Security Test Extensions
**Date: May 6, 2025**

## Overview

This document details the security enhancements made to the quiz generator module, a critical component of the Discord quiz bot that creates token-incentivized quizzes from URL content. These enhancements address multiple edge cases and vulnerabilities that could potentially be exploited to manipulate token distribution through the quiz system.

## Identified Vulnerabilities and Edge Cases

Our security review identified several categories of vulnerabilities in the original quiz generator implementation:

### 1. Content Poisoning Edge Cases
- **HTML/JavaScript Injection**: The original implementation didn't properly sanitize HTML or JavaScript in fetched content
- **Markdown/Rendering Exploits**: No validation against markdown that could break Discord's rendering
- **Unicode Exploits**: No handling of special Unicode characters that might be used to obscure malicious content

### 2. Token-Specific Attack Vectors
- **Question Predictability**: The pseudo-random generation with known seeds made questions potentially predictable
- **Answer Distribution Analysis**: No protection against statistical analysis of answer patterns
- **Reward Maximization Attacks**: The quiz generation algorithm could be studied to maximize chances of correct answers

### 3. Resource Exploitation
- **Large Content DoS**: No limit on maximum content size that could trigger excessive processing
- **Long-running Generation**: No timeout mechanism for question generation process
- **Memory Exhaustion**: The global state tracking for question uniqueness could grow unbounded

### 4. Quiz Quality Manipulation
- **Content Optimization for Easy Questions**: No detection of content crafted to generate predictable questions
- **Minimal Content Looping**: No protection against minimal content that repeats to meet length thresholds
- **Language Model Manipulation**: No safeguards against content designed to exploit patterns in generation

### 5. Multi-Quiz Attack Scenarios
- **Cross-Quiz Analysis**: No protection against correlating multiple quizzes from the same content
- **Quiz Flooding**: No rate limiting to prevent users from creating many quizzes to analyze patterns
- **Historical Quiz Mining**: No protection against users collecting quiz history to predict future questions

### 6. Integration Vulnerabilities
- **Timeout Handling**: No proper timeout or fallback mechanisms for question generation
- **Error Propagation**: Errors might leak too much information about the system
- **State Management**: No clear handling of partial failures during the quiz generation process

### 7. Quiz Distribution Edge Cases
- **Empty Options**: No validation that options contain meaningful content
- **Duplicate Options**: No check for duplicate answer options within a single question
- **Answer Ambiguity**: No validation that there is a clear, unambiguous correct answer

## Security Enhancements Implemented

We implemented a secure quiz generator (`secureQuizGenerator.js`) that addresses these vulnerabilities:

### 1. Content Sanitization
```javascript
function sanitizeContent(text) {
  if (!text) return '';
  
  // First pass: use sanitize-html for HTML/script removal
  let sanitized = sanitizeHtml(text, {
    allowedTags: [], // No HTML tags allowed
    allowedAttributes: {}, // No attributes allowed
    disallowedTagsMode: 'recursiveEscape' // Escape rather than remove
  });
  
  // Second pass: handle unicode exploits
  sanitized = sanitized
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Remove right-to-left override characters
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, '')
    // Normalize other Unicode
    .normalize('NFKC');
  
  // Third pass: handle markdown and other potentially harmful patterns
  sanitized = sanitized
    // Remove potentially malicious markdown links
    .replace(/\[([^\]]*)\]\s*\(\s*(?:javascript|data|vbscript):[^)]*\)/gi, '$1')
    // Remove suspicious URL patterns
    .replace(/(javascript|data|vbscript):/gi, 'blocked:');
  
  return sanitized;
}
```

### 2. Resource Protection

We implemented several measures to protect against resource exhaustion:

#### Memory-Efficient Pattern Caching
```javascript
class PatternCache {
  constructor(maxSize = 1000) {
    this.patterns = new Map();
    this.maxSize = maxSize;
  }
  
  has(pattern) {
    return this.patterns.has(pattern);
  }
  
  add(pattern) {
    // Evict oldest pattern if at capacity
    if (this.patterns.size >= this.maxSize) {
      const oldestKey = this.patterns.keys().next().value;
      this.patterns.delete(oldestKey);
    }
    
    // Add with timestamp as value
    this.patterns.set(pattern, Date.now());
    return this;
  }
}
```

#### Content Size Limits and Timeouts
```javascript
// Create a timeout promise
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Content fetch timeout')), config.timeout);
});

// Race the fetch against timeout
const content = await Promise.race([
  fetchContent(url),
  timeoutPromise
]);

// Content size validation
if (!content.text || 
    content.text.length < 50 || 
    content.text.length > config.contentMaxSize) {
  throw new Error('Content size unsuitable for quiz generation');
}
```

### 3. Question Randomization

We enhanced the unpredictability of questions with better randomization techniques:

#### Deterministic Shuffle with Content-Based Seeding
```javascript
function deterministicShuffle(array, seed) {
  const result = [...array];
  
  // Fisher-Yates shuffle with seed influence
  for (let i = result.length - 1; i > 0; i--) {
    // Use seed, current index and array element to influence randomness
    const value = result[i] || '';
    const j = Math.abs((simpleHash(value + i + seed) % (i + 1)));
    
    // Swap elements
    [result[i], result[j]] = [result[j], result[i]];
  }
  
  return result;
}
```

#### Varied Question Types
```javascript
// Question type variety (different formats for unpredictability)
const questionTypes = ['relation', 'definition', 'application', 'comparison', 'evaluation'];

// Vary question type based on deterministic but unpredictable factors
const typeIndex = (simpleHash(seedWord) + i + sessionId) % questionTypes.length;
const questionType = questionTypes[typeIndex];
```

### 4. Answer Distribution Validation

Added checks to ensure answer distributions can't be predicted:

```javascript
// Calculate answer distribution uniformity
const expectedPerPosition = questions.length / 4;
const distributionDeviation = correctPositions.reduce((sum, count) => {
  return sum + Math.abs(count - expectedPerPosition);
}, 0) / questions.length;

// If answer distribution is too uneven, mark as invalid
if (distributionDeviation > 0.5) {
  return {
    valid: false,
    reason: 'Answer distribution too predictable',
    deviation: distributionDeviation
  };
}
```

### 5. Error Handling

Implemented secure error handling that doesn't leak sensitive information:

```javascript
try {
  // Quiz generation code
} catch (error) {
  // Log detailed error internally but don't expose sensitive details
  console.error('Quiz generation error:', error);
  
  // Generic error message without sensitive information
  throw new Error('Unable to generate quiz from the provided URL');
}
```

## Comprehensive Test Suite

We developed an extensive test suite that validates all security enhancements:

### 1. Content Sanitization Tests
- Tests for HTML/script tag removal
- Tests for Unicode exploit handling
- Tests for markdown injection protection

### 2. Resource Protection Tests
- Tests for handling excessively large content
- Tests for timeouts during content processing
- Tests for memory usage patterns during question generation

### 3. Question Quality Tests
- Tests for question unpredictability
- Tests for answer distribution randomness
- Tests for reasonable difficulty levels

### 4. Error Handling Tests
- Tests for secure error propagation
- Tests for proper timeout handling

## Relation to Token Distribution Security

These security enhancements are particularly important because the quiz generator directly impacts token distribution:

1. **75/25 Token Distribution**: With 75% of tokens going to correct answers and 25% to incorrect answers, any manipulation of the quiz generation process could unfairly distribute tokens.

2. **Answer Predictability**: If attackers could predict correct answers or manipulate question generation, they could unfairly claim a larger portion of the token rewards.

3. **Quiz Content Manipulation**: If users could influence the content processing to generate easier or predictable questions, it would undermine the fairness of the token incentives.

## Next Steps

While the enhanced quiz generator significantly improves security, the following additional measures should be considered:

1. **Rate Limiting**: Implement restrictions on how many quizzes a single user can generate in a given time period.

2. **Advanced Content Analysis**: Add more sophisticated content analysis to detect attempts to game the question generation algorithm.

3. **Audit Logging**: Implement detailed logging of quiz generation patterns to detect and investigate potential exploitation attempts.

4. **Token Reward Caps**: Consider adding maximum token reward limits per user to reduce the incentive for exploitation.

5. **Progressive Integration**: Gradually introduce the security enhancements to production, closely monitoring for any unexpected behavior or performance impacts.

This enhanced quiz generator forms a critical security layer in the overall token-incentivized quiz system, helping ensure that token rewards are distributed fairly based on genuine knowledge rather than exploitation of the system.
