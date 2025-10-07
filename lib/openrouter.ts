import { OPENROUTER_API_BASE_URL, DEFAULT_MODEL, SITE_URL, SITE_NAME } from './constants'

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OpenRouterResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface OpenRouterStreamChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    delta: {
      role?: string
      content?: string
    }
    finish_reason?: string
    index: number
  }>
}

export class OpenRouterClient {
  private apiKey: string
  private baseURL: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || ''
    this.baseURL = OPENROUTER_API_BASE_URL
    
    // Only throw error if no environment API key and no override provided
    if (!this.apiKey && !process.env.OPENROUTER_API_KEY) {
      console.warn('No OpenRouter API key configured. User-provided keys will be required.')
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': SITE_URL,
      'X-Title': SITE_NAME,
    }
  }

  async createChatCompletion(
    messages: OpenRouterMessage[],
    options: {
      model?: string
      stream?: boolean
      temperature?: number
      max_tokens?: number
      apiKey?: string | null | undefined
    } = {}
  ): Promise<OpenRouterResponse | ReadableStream> {
    const {
      model = DEFAULT_MODEL,
      stream = false,
      temperature = 0.7,
      max_tokens = 4000,
      apiKey
    } = options

    const body = {
      model,
      messages,
      stream,
      temperature,
      max_tokens,
    }

    console.log('OpenRouter API request:', {
      url: `${this.baseURL}/chat/completions`,
      model,
      messageCount: messages.length,
      stream,
    })

    // Use provided API key or fall back to instance API key
    const effectiveApiKey = apiKey || this.apiKey
    
    if (!effectiveApiKey) {
      throw new Error('OpenRouter API key is required. Please configure an API key in settings.')
    }
    
    const headers = {
      'Authorization': `Bearer ${effectiveApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': SITE_URL,
      'X-Title': SITE_NAME,
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenRouter API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      })
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`)
    }

    if (stream) {
      return response.body as ReadableStream
    } else {
      return await response.json() as OpenRouterResponse
    }
  }

  async listModels(): Promise<{ data: Array<{ id: string, object: string, created: number, owned_by: string }> }> {
    const response = await fetch(`${this.baseURL}/models`, {
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }
}

// Create a default client instance
export const openrouter = new OpenRouterClient()