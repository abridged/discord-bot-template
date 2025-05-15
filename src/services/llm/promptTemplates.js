/**
 * LLM Service - Prompt Templates
 * Contains structured prompts for different LLM tasks
 */

module.exports = {
  /**
   * Generate a quiz from content
   * @param {string} content - The extracted content
   * @param {number} numQuestions - Number of questions to generate
   * @param {string} difficulty - Difficulty level (easy, medium, hard)
   * @returns {string} - Formatted prompt
   */
  quizGeneration: (content, numQuestions = 3, difficulty = 'medium') => {
    // Adjust detailed instructions based on difficulty
    let detailedInstructions = '';
    
    switch(difficulty.toLowerCase()) {
      case 'easy':
        detailedInstructions = 'Create fun, straightforward questions targeting basic comprehension. Use friendly, simple language and focus on clearly stated facts. Make the quiz accessible and enjoyable for beginners.';
        break;
      case 'hard':
        detailedInstructions = 'Create intriguing, challenging questions requiring deeper understanding. Include questions about implications, relationships between concepts, and nuanced details. Design questions that will engage knowledgeable participants.';
        break;
      case 'medium':
      default:
        detailedInstructions = 'Create entertaining, moderately challenging questions that test understanding of the main concepts. Include interesting details while maintaining a friendly, approachable tone. Balance depth with accessibility.';
        break;
    }
    
    return `
Generate ${numQuestions} multiple choice questions based on this content:

---
${content}
---

${detailedInstructions}

For each question:
1. Create clear, concise, and engaging questions that have a friendly tone with a bit of flair to make them entertaining
2. Provide exactly 3 SPECIFIC and DETAILED answer options that are meaningful and informative
3. DO NOT use generic placeholders like "Option A" or "Option B" - each option must be a complete, meaningful answer
4. Identify which option is correct (as an index number)
5. Make sure options are distinct from each other and factually accurate based on the source content
6. Provide concrete, specific answer choices with actual content (e.g., "A chronological record of transactions" NOT "Option A")
7. Ensure questions and answers are contextually relevant to the source content and demonstrate understanding of the material
8. Keep questions and answers concise, approachable, and fun when appropriate
9. The final options presented will include these 3 plus "All of the above" and "None of the above", so ensure your options work with these additions
10. Avoid overly technical jargon unless the source content requires it
11. Write questions that test comprehension and critical thinking, not just memorization
12. Do not refer to specific line numbers or page numbers

Format your response as a JSON array:
[
  {
    "question": "Question text goes here?",
    "options": ["First option", "Second option", "Third option"],
    "correctOptionIndex": 0
  }
]

IMPORTANT: Only include questions that can be directly answered from the provided content. Do not make up information.
    `.trim();
  },
  
  /**
   * Validate questions against source content
   * @param {Array} questions - Generated questions
   * @param {string} content - Original content
   * @returns {string} - Formatted prompt
   */
  quizValidation: (questions, content) => {
    return `
You are a fact-checking assistant. Review these quiz questions against the original content to verify accuracy.

Original content:
---
${content}
---

Questions to validate:
${JSON.stringify(questions, null, 2)}

For each question:
1. Check if the question can be answered from the content
2. Verify that the correct answer is actually correct
3. Verify that wrong answers are actually wrong
4. Check if questions are distinct from each other

Output your validation as JSON:
{
  "validQuestions": [],  // Array of validated questions (include corrected versions if needed)
  "invalidQuestions": [], // Array of question indexes that should be rejected
  "validationReport": "" // Brief explanation of any issues found
}
    `.trim();
  }
};
