# LLM Quiz Generation Architecture

**Date:** 2025-05-14
**Author:** Cascade
**Type:** Architecture Documentation
**Status:** Implemented

## Overview

This document outlines the architecture for the LLM-powered quiz generation system implemented in the Discord bot. The system has been designed with a modular, service-oriented approach to facilitate future transition to a multi-agent architecture while maintaining the current monolithic structure.

## Service Architecture

The quiz generation system is composed of four main services:

```
src/
├── services/
│   ├── content/         # Content extraction from URLs
│   ├── llm/             # LLM integration for quiz generation
│   ├── validation/      # Quiz quality validation
│   └── quiz/            # Orchestration layer
```

### Content Service

Responsible for extracting meaningful content from URLs.

**Key Components:**
- `extractor.js` - Extracts content from various formats (HTML, text)
- `cache.js` - Provides caching to avoid redundant network requests

**Interface:**
```javascript
extractContentFromURL(url: string): Promise<{ title: string, text: string }>
```

### LLM Service

Handles the interaction with LLM APIs to generate quiz questions.

**Key Components:**
- `quizGenerator.js` - Generates quiz questions from content
- `promptTemplates.js` - Contains structured prompts for different LLM tasks

**Interface:**
```javascript
generateQuestionsFromContent(content: Object, options: Object): Promise<Array>
generateQuiz(url: string, options: Object): Promise<Object>
standardizeQuestions(questions: Array): Array
```

### Validation Service

Ensures the quality and relevance of generated quizzes.

**Key Components:**
- `quizValidator.js` - Validates questions for quality and relevance

**Interface:**
```javascript
validateQuiz(questions: Array, sourceContent: string, options: Object): Object
```

### Quiz Orchestration Service

Coordinates the flow between other services to create a complete quiz.

**Key Components:**
- `orchestrator.js` - Orchestrates the entire quiz generation pipeline

**Interface:**
```javascript
createQuizFromUrl(url: string, options: Object): Promise<Object>
```

## Design Considerations

### Future Multi-Agent Compatibility

The services are designed with clear boundaries and interfaces to facilitate future evolution into a multi-agent architecture:

1. **Content Service** → Future MCP-based Content Extraction Agent
2. **LLM Service** → Future Quiz Generation Agent
3. **Validation Service** → Future Quality Assurance Agent
4. **Quiz Orchestration Service** → Future Orchestrator Agent

### Standardized 5-Option Format

All questions are automatically standardized to a 5-option format:
- Three regular options (A, B, C)
- "All of the above" option (D)
- "None of the above" option (E)

### Error Handling

Robust error handling is implemented throughout the system:
- Content extraction errors (invalid URLs, network issues)
- LLM API errors (rate limits, token limits)
- Validation errors (irrelevant content, quality issues)

## Integration Points

### Discord Command Integration

The `/ask` command has been updated to use the new quiz generation service:

```javascript
// Extract parameters from command
const url = interaction.options.getString('url');
// ...

// Generate quiz using our service
const quiz = await createQuizFromUrl(url, options);

// Send preview to the user
await sendEphemeralPreview(interaction, quiz);
```

### Environment Configuration

LLM configuration is managed via environment variables:
- `OPENAI_API_KEY` - API key for OpenAI
- `LLM_MODEL` - Model to use for generation (default: gpt-3.5-turbo)
- `LLM_TEMPERATURE` - Temperature for generation (default: 0.7)
- `LLM_MAX_TOKENS` - Maximum tokens for generation (default: 4000)

## Test Coverage

Comprehensive tests have been implemented for all services:
- Content extraction tests
- LLM integration tests
- Validation tests
- Orchestration tests

## Future Enhancements

1. **Improved Prompts**: Refine LLM prompts for better question quality
2. **Advanced Content Extraction**: Support for PDF, images, and other formats
3. **Feedback Loop**: Integrate user feedback to improve question quality
4. **MCP Migration**: Break out services into MCP-compliant microservices
5. **A2A Protocol**: Implement full A2A protocol for inter-agent communication

This architecture provides a solid foundation for the future multi-agent system while delivering immediate value in the current monolithic implementation.
