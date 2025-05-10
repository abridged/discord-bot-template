/**
 * Content Fetcher
 * 
 * Fetches and extracts content from URLs for quiz generation
 */

/**
 * Fetches content from a specified URL
 * @param {string} url - The URL to fetch content from
 * @returns {Promise<Object>} - Object containing title and text content
 */
async function fetchContent(url) {
  // TODO: Implement actual content fetching
  // This would use a library like axios, fetch or cheerio
  
  // For now, return a mock implementation
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL');
  }
  
  // Support testing URLs
  if (process.env.NODE_ENV === 'test' || url.includes('example.com')) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Special test case for HTML/script injection test
    if (url.includes('malicious-content')) {
      return {
        title: 'Legitimate Looking Title',
        text: 'Normal text <script>alert("XSS")</script> with some javascript injection and more normal text.'
      };
    }
    
    // Special test case for markdown exploits
    if (url.includes('markdown-exploit')) {
      return {
        title: 'Markdown Article',
        text: 'Text with [malicious link](javascript:alert("bad")) and ![image](onerror="alert(\'xss\')") and ```js\nalert("code block exploit")\n```'
      };
    }
    
    // Special test case for unicode exploits
    if (url.includes('unicode-exploit')) {
      return {
        title: 'Unicode Article',
        text: 'Normal text with zero-width\u200Bjoiner and right-to-left\u202Eoverride character to mask code'
      };
    }
    
    // Default rich test content
    return {
      title: 'Example Test Article',
      text: 'This is a comprehensive article with substantial content that can be used for quiz generation. ' +
            'It contains multiple paragraphs and topics to ensure there is enough material to create diverse questions. ' +
            'The first section discusses the fundamentals of software development and best practices. ' +
            'We cover version control systems like Git, testing frameworks, and deployment strategies. ' +
            'The second section delves into advanced topics including architecture patterns, security considerations, ' +
            'and performance optimization techniques. Finally, we explore emerging technologies and future trends ' +
            'in the software industry, including artificial intelligence, blockchain, and quantum computing. ' +
            'This extensive content should provide ample material for generating meaningful quiz questions.'
    };
  }
  
  // Regular implementation for non-test URLs
  if (!url.startsWith('http')) {
    throw new Error('Invalid URL');
  }
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return {
    title: 'Example Article',
    text: 'This is a placeholder text. The actual implementation will extract real content from the provided URL.'
  };
}

module.exports = {
  fetchContent
};
