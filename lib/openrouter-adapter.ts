import { OpenRouterClient, OpenRouterMessage } from './openrouter'
import { nanoid } from 'nanoid'

// Adapter to make OpenRouter compatible with v0-like interface
export interface ChatMessage {
  id?: string
  role: 'system' | 'user' | 'assistant'
  content: string
  created_at?: number
}

export interface ChatDetail {
  id: string
  created_at: number
  updated_at: number
  demo?: boolean
  messages: ChatMessage[]
}

export interface CreateChatOptions {
  message: string
  responseMode?: 'sync' | 'experimental_stream'
  attachments?: any[]
  model?: string
  apiKey?: string | null | undefined
}

export interface SendMessageOptions {
  chatId: string
  message: string
  responseMode?: 'sync' | 'experimental_stream'
  attachments?: any[]
  model?: string
  apiKey?: string | null | undefined
}

export class OpenRouterAdapter {
  private client: OpenRouterClient
  private chatStore: Map<string, ChatDetail> = new Map()

  constructor() {
    this.client = new OpenRouterClient()
  }

  async createChat(options: CreateChatOptions): Promise<ChatDetail | ReadableStream> {
    const { message, responseMode = 'sync', model, apiKey } = options
    
    const chatId = nanoid()
    const timestamp = Date.now()
    
    const userMessage: ChatMessage = {
      id: nanoid(),
      role: 'user',
      content: message,
      created_at: timestamp,
    }

    // Initialize chat
    const chat: ChatDetail = {
      id: chatId,
      created_at: timestamp,
      updated_at: timestamp,
      demo: true, // Mark as demo for compatibility
      messages: [userMessage],
    }

    const openRouterMessages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: 'You are a helpful AI assistant that can help users build applications, write code, and solve problems. Be concise and practical in your responses.'
      },
      {
        role: 'user',
        content: message,
      },
    ]

    if (responseMode === 'experimental_stream') {
      // Return streaming response
      const stream = await this.client.createChatCompletion(openRouterMessages, {
        model,
        stream: true,
        apiKey,
      }) as ReadableStream

      // Transform the stream to match v0 format
      return this.transformStreamToV0Format(stream, chat)
    } else {
      // Sync response
      const response = await this.client.createChatCompletion(openRouterMessages, {
        model,
        stream: false,
        apiKey,
      }) as any

      const assistantMessage: ChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: response.choices[0]?.message?.content || 'No response generated',
        created_at: Date.now(),
      }

      chat.messages.push(assistantMessage)
      chat.updated_at = Date.now()
      
      // Store chat for future reference
      this.chatStore.set(chatId, chat)

      return chat
    }
  }

  async sendMessage(options: SendMessageOptions): Promise<ChatDetail | ReadableStream> {
    const { chatId, message, responseMode = 'sync', model, apiKey } = options
    
    // Get existing chat or create a new one if not found
    let chat = this.chatStore.get(chatId)
    if (!chat) {
      // If chat doesn't exist, create a new one
      return this.createChat({ message, responseMode, model, apiKey })
    }

    const userMessage: ChatMessage = {
      id: nanoid(),
      role: 'user',
      content: message,
      created_at: Date.now(),
    }

    chat.messages.push(userMessage)

    // Convert chat messages to OpenRouter format
    const openRouterMessages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: 'You are a helpful AI assistant that can help users build applications, write code, and solve problems. Be concise and practical in your responses.'
      },
      ...chat.messages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    ]

    if (responseMode === 'experimental_stream') {
      // Return streaming response
      const stream = await this.client.createChatCompletion(openRouterMessages, {
        model,
        stream: true,
        apiKey,
      }) as ReadableStream

      return this.transformStreamToV0Format(stream, chat)
    } else {
      // Sync response
      const response = await this.client.createChatCompletion(openRouterMessages, {
        model,
        stream: false,
        apiKey,
      }) as any

      const assistantMessage: ChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: response.choices[0]?.message?.content || 'No response generated',
        created_at: Date.now(),
      }

      chat.messages.push(assistantMessage)
      chat.updated_at = Date.now()
      
      // Update stored chat
      this.chatStore.set(chatId, chat)

      return chat
    }
  }

  async getChat(chatId: string): Promise<ChatDetail | null> {
    return this.chatStore.get(chatId) || null
  }

  async listChats(): Promise<{ data: ChatDetail[] }> {
    return {
      data: Array.from(this.chatStore.values())
    }
  }

  private transformStreamToV0Format(stream: ReadableStream, chat: ChatDetail): ReadableStream {
    const reader = stream.getReader()
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const chatStore = this.chatStore // Capture reference to avoid 'this' context issues

    return new ReadableStream({
      async start(controller) {
        let assistantMessage = ''
        const assistantMessageId = nanoid()
        
        try {
          while (true) {
            const { done, value } = await reader.read()
            
            if (done) {
              // Finalize the assistant message
              const finalMessage: ChatMessage = {
                id: assistantMessageId,
                role: 'assistant',
                content: assistantMessage,
                created_at: Date.now(),
              }
              
              chat.messages.push(finalMessage)
              chat.updated_at = Date.now()
              
              // Store the completed chat
              chatStore.set(chat.id, chat)
              
              // Send final event
              const finalEvent = `data: ${JSON.stringify({
                type: 'chat_complete',
                chat: chat
              })}\n\n`
              
              controller.enqueue(encoder.encode(finalEvent))
              controller.close()
              break
            }

            const chunk = decoder.decode(value)
            const lines = chunk.split('\n')
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') {
                  continue
                }
                
                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices?.[0]?.delta?.content
                  
                  if (content) {
                    assistantMessage += content
                    
                    // Send streaming update in v0 format
                    const event = `data: ${JSON.stringify({
                      type: 'message_delta',
                      content: content,
                      messageId: assistantMessageId
                    })}\n\n`
                    
                    controller.enqueue(encoder.encode(event))
                  }
                } catch (e) {
                  // Skip malformed JSON
                  continue
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream transformation error:', error)
          controller.error(error)
        }
      }
    })
  }
}

// Create a default adapter instance
export const openRouterAdapter = new OpenRouterAdapter()