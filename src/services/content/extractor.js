/**
 * Content Extraction Service
 * Extracts meaningful content from URLs
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { getCachedContent, cacheContent } = require('./cache');

/**
 * Extract content from a URL
 * @param {string} url - The URL to extract content from
 * @returns {Promise<Object>} - Extracted content object with title and text
 */
async function extractContentFromURL(url) {
  try {
    // Validate URL
    if (!isValidURL(url)) {
      throw new Error('Invalid URL format');
    }
    
    // Check cache first
    const cachedContent = await getCachedContent(url);
    if (cachedContent) {
      console.log('Returning cached content for:', url);
      return cachedContent;
    }
    
    // Fetch content if not cached
    console.log('Fetching content from:', url);
    const response = await axios.get(url, {
      timeout: 10000, // 10 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; QuizBot/1.0)'
      }
    });
    
    // Determine content type and use appropriate extractor
    const contentType = response.headers['content-type'] || '';
    let extractedContent;
    
    if (contentType.includes('text/html')) {
      extractedContent = extractFromHTML(response.data);
    } else if (contentType.includes('application/pdf')) {
      extractedContent = { title: getTitleFromUrl(url), text: 'PDF content extraction not yet implemented' };
    } else if (contentType.includes('text/plain')) {
      extractedContent = { 
        title: getTitleFromUrl(url), 
        text: response.data.substring(0, 20000) // Limit to 20k chars
      };
    } else {
      extractedContent = { title: getTitleFromUrl(url), text: 'Unsupported content type' };
    }
    
    // Clean up the content
    extractedContent.text = cleanContent(extractedContent.text);
    
    // Check if content is substantial enough
    if (extractedContent.text.length < 100) {
      throw new Error('Content too short to generate meaningful quiz');
    }
    
    // Cache the content
    await cacheContent(url, extractedContent);
    
    return extractedContent;
  } catch (error) {
    console.error('Error extracting content:', error.message);
    throw new Error('Invalid URL or unable to fetch content: ' + error.message);
  }
}

/**
 * Extract meaningful content from HTML
 * @param {string} html - Raw HTML content
 * @returns {Object} - Extracted title and text
 */
function extractFromHTML(html) {
  const $ = cheerio.load(html);
  
  // Remove irrelevant elements
  $('script, style, nav, footer, header, aside, .ads, .comments, .sidebar').remove();
  
  // Extract title
  let title = $('title').text().trim();
  if (!title) {
    title = $('h1').first().text().trim();
  }
  
  // Focus on content elements
  const contentElements = $('article, main, .content, .post, p, h1, h2, h3, h4, h5, li');
  
  // Extract text
  let extractedText = '';
  contentElements.each((_, element) => {
    const text = $(element).text().trim();
    if (text) extractedText += text + ' ';
  });
  
  return { title, text: extractedText.trim() };
}

/**
 * Clean and normalize extracted content
 * @param {string} content - Raw extracted content
 * @returns {string} - Cleaned content
 */
function cleanContent(content) {
  if (!content) return '';
  
  // First remove script-like content to avoid creating double spaces later
  let cleaned = content.replace(/\bconst\b|\blet\b|\bvar\b|\bfunction\b|\b=>\b/g, '');
  
  // Then normalize whitespace - replace all whitespace sequences with a single space
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Limit content length if it's too large
  if (cleaned.length > 20000) {
    cleaned = cleaned.substring(0, 20000) + '...';
  }
  
  // Final check for any remaining double spaces (just to be safe)
  cleaned = cleaned.replace(/  +/g, ' ');
  
  return cleaned;
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} - Is valid URL
 */
function isValidURL(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Extract title from URL if no title found
 * @param {string} url - URL to extract title from
 * @returns {string} - Extracted title
 */
function getTitleFromUrl(url) {
  try {
    const urlObj = new URL(url);
    // Use hostname and pathname for title
    let title = urlObj.hostname.replace('www.', '');
    // Add first part of path if present
    if (urlObj.pathname && urlObj.pathname !== '/') {
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        title += ' - ' + pathParts[0].replace(/-|_/g, ' ');
      }
    }
    return title;
  } catch (e) {
    return 'Unknown Source';
  }
}

module.exports = {
  extractContentFromURL,
  extractFromHTML,
  cleanContent,
  isValidURL,
  getTitleFromUrl
};
