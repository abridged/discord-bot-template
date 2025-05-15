/**
 * Content Extraction Service Tests
 */

const { extractContentFromURL, extractFromHTML, cleanContent } = require('../../../services/content/extractor');
const { getCachedContent, cacheContent, clearCache } = require('../../../services/content/cache');

// Mock axios
jest.mock('axios');
const axios = require('axios');

describe('Content Extraction Service', () => {
  beforeEach(() => {
    // Clear mocks and cache before each test
    jest.clearAllMocks();
    clearCache();
  });
  
  describe('URL Content Extraction', () => {
    test('should extract content from HTML pages', async () => {
      // Mock axios response
      axios.get.mockResolvedValueOnce({
        headers: { 'content-type': 'text/html' },
        data: `
          <html>
            <head><title>Test Page</title></head>
            <body>
              <h1>Main Heading</h1>
              <p>This is test content for extraction.</p>
              <div class="content">
                <p>More detailed content here.</p>
              </div>
              <script>console.log("should be ignored");</script>
            </body>
          </html>
        `
      });
      
      const result = await extractContentFromURL('https://example.com');
      
      // Check that axios was called with correct URL
      expect(axios.get).toHaveBeenCalledWith('https://example.com', expect.any(Object));
      
      // Check that content was extracted correctly
      expect(result).toHaveProperty('title', 'Test Page');
      expect(result).toHaveProperty('text');
      expect(result.text).toContain('Main Heading');
      expect(result.text).toContain('test content for extraction');
      expect(result.text).toContain('More detailed content here');
      
      // Check that script content was excluded
      expect(result.text).not.toContain('should be ignored');
    });
    
    test('should handle invalid URLs', async () => {
      await expect(extractContentFromURL('not-a-url')).rejects.toThrow('Invalid URL');
    });
    
    test('should use cache for repeated requests', async () => {
      // Mock axios response for first call with longer content that will pass the length check
      axios.get.mockResolvedValueOnce({
        headers: { 'content-type': 'text/html' },
        data: `<html>
          <head><title>Cached Page</title></head>
          <body>
            <article>
              <h1>Test Article</h1>
              <p>This is cached content that is long enough to pass the content length check. 
              We need to ensure it has more than 100 characters to avoid the validation error 
              that would be thrown for content that is too short to generate a meaningful quiz.</p>
              <p>Additional paragraph to make sure we have plenty of content.</p>
            </article>
          </body>
        </html>`
      });
      
      // First call should hit the network
      const url = 'https://example.com/cached';
      const result1 = await extractContentFromURL(url);
      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(result1.title).toBe('Cached Page');
      
      // Reset axios mock to verify it's not called again
      axios.get.mockClear();
      
      // Second call should use cache
      const result2 = await extractContentFromURL(url);
      expect(axios.get).not.toHaveBeenCalled();
      expect(result2.title).toBe('Cached Page');
    });
  });
  
  describe('HTML Content Extraction', () => {
    test('should extract relevant content from HTML', () => {
      const html = `
        <html>
          <head><title>Test Title</title></head>
          <body>
            <nav>Navigation (should be ignored)</nav>
            <article>
              <h1>Article Heading</h1>
              <p>Important content</p>
            </article>
            <footer>Footer (should be ignored)</footer>
          </body>
        </html>
      `;
      
      const result = extractFromHTML(html);
      
      expect(result.title).toBe('Test Title');
      expect(result.text).toContain('Article Heading');
      expect(result.text).toContain('Important content');
      expect(result.text).not.toContain('Navigation (should be ignored)');
      expect(result.text).not.toContain('Footer (should be ignored)');
    });
  });
  
  describe('Content Cleaning', () => {
    test('should clean and normalize extracted content', () => {
      const rawContent = '  This  has  excess   spacing   and\n\nline breaks\n\nconst x = 5; // code that should be removed';
      
      const cleaned = cleanContent(rawContent);
      
      expect(cleaned).not.toContain('  ');  // No double spaces
      expect(cleaned).not.toContain('\n');  // No line breaks
      expect(cleaned).toContain('This has excess spacing and line breaks');
      expect(cleaned).not.toContain('const x = 5');  // Code fragments removed
    });
  });
});
