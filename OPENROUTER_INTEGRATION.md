# OpenRouter Integration Documentation

## Overview

This document describes the OpenRouter API integration that has been implemented in the v0-clonee project. The integration allows users to:

1. **Use their own OpenRouter API keys** instead of relying on a centralized API key
2. **Select from free models** available through OpenRouter
3. **Manage API keys securely** through a user-friendly interface
4. **Switch between different AI models** dynamically

## Features Implemented

### 1. API Key Management Component

**Location**: `components/settings/openrouter-settings.tsx`

Features:
- Secure API key input with show/hide toggle
- Local storage persistence for API keys
- API key validation and testing
- Model selection dropdown that loads available free models
- Real-time status indicators

**Usage**:
```tsx
import { OpenRouterSettings } from '@/components/settings/openrouter-settings'

// Component is already integrated into the app header
<OpenRouterSettings />
```

### 2. Free Models API

**Endpoint**: `/api/openrouter/models`
**Method**: GET

Returns a list of all free models available through OpenRouter:

```bash
curl -X GET http://localhost:3000/api/openrouter/models
```

**Response**:
```json
{
  "freeModels": [
    {
      "id": "deepseek/deepseek-chat-v3.1:free",
      "name": "DeepSeek Chat v3.1 (Free)",
      "context_length": 65536,
      "pricing": {"prompt": "0", "completion": "0"}
    }
    // ... more models
  ]
}
```

### 3. API Key Testing

**Endpoint**: `/api/openrouter/test`
**Method**: POST

Tests the validity of a user-provided API key:

```bash
curl -X POST http://localhost:3000/api/openrouter/test \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "sk-or-v1-your-key-here"}'
```

**Response (Success)**:
```json
{
  "success": true,
  "message": "API key is valid",
  "modelCount": 324
}
```

**Response (Error)**:
```json
{
  "error": "Invalid API key or unauthorized"
}
```

### 4. Enhanced Chat API

The chat API (`/api/chat`) now accepts user-provided API keys and model selection through headers:

**Headers**:
- `x-openrouter-api-key`: User's OpenRouter API key
- `x-openrouter-model`: Selected model ID

**Example**:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "x-openrouter-api-key: sk-or-v1-your-key-here" \
  -H "x-openrouter-model: deepseek/deepseek-chat-v3.1:free" \
  -d '{"message": "Hello world", "streaming": false}'
```

## Technical Architecture

### 1. OpenRouter Client (`lib/openrouter.ts`)

Core client for interacting with OpenRouter API:

```typescript
export class OpenRouterClient {
  async createChatCompletion(
    messages: OpenRouterMessage[],
    options: {
      model?: string
      stream?: boolean
      temperature?: number
      max_tokens?: number
      apiKey?: string | null | undefined  // User-provided API key
    } = {}
  ): Promise<OpenRouterResponse | ReadableStream>
}
```

**Key Features**:
- Supports both environment API keys and user-provided keys
- Handles streaming and non-streaming responses
- Proper error handling with detailed error messages

### 2. OpenRouter Adapter (`lib/openrouter-adapter.ts`)

Compatibility layer that makes OpenRouter work with the existing v0-like interface:

```typescript
export class OpenRouterAdapter {
  async createChat(options: CreateChatOptions): Promise<ChatDetail | ReadableStream>
  async sendMessage(options: SendMessageOptions): Promise<ChatDetail | ReadableStream>
}
```

**Key Features**:
- Maintains compatibility with existing chat interface
- Handles message history and chat storage
- Supports both streaming and synchronous responses
- Accepts user-provided API keys and models

### 3. Frontend Integration

**LocalStorage Keys**:
- `openrouter_api_key`: Stores user's API key
- `openrouter_selected_model`: Stores selected model ID

**Chat Hooks Update**:
Both `hooks/use-chat.ts` and `components/home/home-client.tsx` have been updated to:
- Read API key and model from localStorage
- Send them as headers with chat requests
- Handle cases where no API key is provided

## User Experience Flow

### 1. Initial Setup
1. User clicks "OpenRouter" button in the header
2. Settings dialog opens
3. User enters their OpenRouter API key
4. System validates the key and loads available free models
5. User selects a preferred model
6. Settings are saved to localStorage

### 2. Chat Usage
1. User starts a chat conversation
2. Frontend reads API key and model from localStorage
3. Chat request includes user's API key and selected model as headers
4. Backend uses user's API key to make requests to OpenRouter
5. Response is streamed back to the user

### 3. Error Handling
- **No API key**: Clear error message prompting user to configure API key
- **Invalid API key**: Validation error with suggestion to check key
- **Model unavailable**: Fallback to default model or error message
- **Rate limiting**: Handled gracefully with user-friendly messages

## Security Considerations

### 1. API Key Storage
- API keys are stored in browser localStorage (client-side only)
- Keys are never sent to our backend database
- Keys are only transmitted to OpenRouter via HTTPS

### 2. Validation
- API keys are validated before use
- Invalid keys result in clear error messages
- No API key logging in production

### 3. Fallback Behavior
- System can still use environment API key if no user key provided
- Graceful degradation when OpenRouter API is unavailable
- Database failures don't break the chat functionality

## Configuration

### Environment Variables

```bash
# Optional: Default API key for fallback
OPENROUTER_API_KEY=sk-or-v1-your-fallback-key

# Site attribution (required by OpenRouter)
SITE_URL=http://localhost:3000
SITE_NAME=v0-clone

# Default model if none selected
DEFAULT_MODEL=deepseek/deepseek-chat-v3.1:free
```

### OpenRouter Constants (`lib/constants.ts`)

```typescript
export const OPENROUTER_API_BASE_URL = 'https://openrouter.ai/api/v1'
export const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'deepseek/deepseek-chat-v3.1:free'
export const SITE_URL = process.env.SITE_URL || 'http://localhost:3000'
export const SITE_NAME = process.env.SITE_NAME || 'v0-clone'
```

## Testing

### 1. API Key Testing
```bash
# Test valid API key
curl -X POST http://localhost:3000/api/openrouter/test \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "sk-or-v1-your-real-key"}'

# Test invalid API key
curl -X POST http://localhost:3000/api/openrouter/test \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "invalid-key"}'
```

### 2. Models Endpoint
```bash
# Get free models
curl -X GET http://localhost:3000/api/openrouter/models
```

### 3. Chat with User API Key
```bash
# Chat with user-provided key and model
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "x-openrouter-api-key: sk-or-v1-your-key" \
  -H "x-openrouter-model: deepseek/deepseek-chat-v3.1:free" \
  -d '{"message": "Test message", "streaming": false}'
```

## Available Free Models

As of implementation, OpenRouter provides access to many free models including:

- **DeepSeek Chat v3.1**: `deepseek/deepseek-chat-v3.1:free` (65K context)
- **Gemini Flash 1.5**: `google/gemini-flash-1.5:free` (1M context)
- **Llama 3.2 3B**: `meta-llama/llama-3.2-3b-instruct:free` (131K context)
- **GLM 4.5 Air**: `z-ai/glm-4.5-air:free` (131K context)
- **Many others** - the list is dynamically fetched from OpenRouter

## Troubleshooting

### Common Issues

1. **"API key is required" error**
   - Solution: Configure API key in OpenRouter settings

2. **"Invalid API key" error**
   - Solution: Verify API key at https://openrouter.ai/keys

3. **No models loading**
   - Solution: Check API key validity and internet connection

4. **Chat not working**
   - Solution: Ensure both API key and model are selected

### Logs to Check

The system provides detailed logging for debugging:
- OpenRouter API requests and responses
- API key validation attempts
- Model selection and chat creation
- Error details with full stack traces

## Migration Notes

### From v0 SDK to OpenRouter

The integration maintains backward compatibility:
- Existing chats continue to work
- No database schema changes required
- Environment API key still works as fallback
- All existing features remain functional

### Breaking Changes

None - this is a pure addition to existing functionality.

## Future Enhancements

Potential improvements for future versions:

1. **API Key Encryption**: Encrypt keys in localStorage
2. **Multiple API Keys**: Support for multiple provider keys
3. **Usage Analytics**: Track API usage and costs
4. **Model Comparison**: Side-by-side model testing
5. **Custom Model Parameters**: Temperature, max tokens, etc.
6. **API Key Sharing**: Team/organization key management

## Support

For issues related to:
- **OpenRouter API**: Check https://openrouter.ai/docs
- **API Keys**: Visit https://openrouter.ai/keys
- **Model Availability**: See https://openrouter.ai/models

This integration successfully provides users with full control over their AI model usage while maintaining the existing user experience.