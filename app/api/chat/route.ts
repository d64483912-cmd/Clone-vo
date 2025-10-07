import { NextRequest, NextResponse } from 'next/server'
import { openRouterAdapter, ChatDetail } from '@/lib/openrouter-adapter'
import { auth } from '@/app/(auth)/auth'
import {
  createChatOwnership,
  createAnonymousChatLog,
  getChatCountByUserId,
  getChatCountByIP,
} from '@/lib/db/queries'
import {
  entitlementsByUserType,
  anonymousEntitlements,
} from '@/lib/entitlements'
import { ChatSDKError } from '@/lib/errors'

// Using OpenRouter adapter instead of v0 SDK
// Configuration is handled through environment variables

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')

  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  if (realIP) {
    return realIP
  }

  // Fallback to connection remote address or unknown
  return 'unknown'
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const { message, chatId, streaming, attachments, projectId } =
      await request.json()

    // Get user-provided API key and model from headers
    const userApiKey = request.headers.get('x-openrouter-api-key') || undefined
    const userModel = request.headers.get('x-openrouter-model') || undefined

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 },
      )
    }

    // Rate limiting
    if (session?.user?.id) {
      // Authenticated user rate limiting
      try {
        const chatCount = await getChatCountByUserId({
          userId: session.user.id,
          differenceInHours: 24,
        })

        const userType = session.user.type
        if (chatCount >= entitlementsByUserType[userType].maxMessagesPerDay) {
          return new ChatSDKError('rate_limit:chat').toResponse()
        }
      } catch (dbError) {
        console.warn('Database unavailable for rate limiting, proceeding without limits:', dbError)
        // Continue without rate limiting when database is unavailable
      }

      console.log('API request:', {
        message,
        chatId,
        streaming,
        userId: session.user.id,
      })
    } else {
      // Anonymous user rate limiting
      const clientIP = getClientIP(request)
      try {
        const chatCount = await getChatCountByIP({
          ipAddress: clientIP,
          differenceInHours: 24,
        })

        if (chatCount >= anonymousEntitlements.maxMessagesPerDay) {
          return new ChatSDKError('rate_limit:chat').toResponse()
        }
      } catch (dbError) {
        console.warn('Database unavailable for rate limiting, proceeding without limits:', dbError)
        // Continue without rate limiting when database is unavailable
      }

      console.log('API request (anonymous):', {
        message,
        chatId,
        streaming,
        ip: clientIP,
      })
    }

    console.log('Using OpenRouter API')

    let chat

    if (chatId) {
      // continue existing chat
      if (streaming) {
        // Return streaming response for existing chat
        console.log('Sending streaming message to existing chat:', {
          chatId,
          message,
          responseMode: 'experimental_stream',
        })
        chat = await openRouterAdapter.sendMessage({
          chatId: chatId,
          message,
          responseMode: 'experimental_stream',
          apiKey: userApiKey,
          model: userModel,
        })
        console.log('Streaming message sent to existing chat successfully')

        // Return the stream directly
        return new Response(chat as ReadableStream<Uint8Array>, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        })
      } else {
        // Non-streaming response for existing chat
        chat = await openRouterAdapter.sendMessage({
          chatId: chatId,
          message,
          responseMode: 'sync',
          apiKey: userApiKey,
          model: userModel,
        })
      }
    } else {
      // create new chat
      if (streaming) {
        // Return streaming response
        console.log('Creating streaming chat with params:', {
          message,
          responseMode: 'experimental_stream',
        })
        chat = await openRouterAdapter.createChat({
          message,
          responseMode: 'experimental_stream',
          apiKey: userApiKey,
          model: userModel,
        })
        console.log('Streaming chat created successfully')

        // Return the stream directly
        return new Response(chat as ReadableStream<Uint8Array>, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        })
      } else {
        // Use sync mode
        console.log('Creating sync chat with params:', {
          message,
          responseMode: 'sync',
        })
        chat = await openRouterAdapter.createChat({
          message,
          responseMode: 'sync',
          apiKey: userApiKey,
          model: userModel,
        })
        console.log('Sync chat created successfully')
      }
    }

    // Type guard to ensure we have a ChatDetail and not a stream
    if (chat instanceof ReadableStream) {
      throw new Error('Unexpected streaming response')
    }

    const chatDetail = chat as ChatDetail

    // Create ownership mapping or anonymous log for new chat
    if (!chatId && chatDetail.id) {
      try {
        if (session?.user?.id) {
          // Authenticated user - create ownership mapping
          try {
            await createChatOwnership({
              v0ChatId: chatDetail.id,
              userId: session.user.id,
            })
            console.log('Chat ownership created:', chatDetail.id)
          } catch (dbError) {
            console.warn('Database unavailable for chat ownership:', dbError)
            // Continue without ownership tracking when database is unavailable
          }
        } else {
          // Anonymous user - log for rate limiting
          const clientIP = getClientIP(request)
          try {
            await createAnonymousChatLog({
              ipAddress: clientIP,
              v0ChatId: chatDetail.id,
            })
            console.log('Anonymous chat logged:', chatDetail.id, 'IP:', clientIP)
          } catch (dbError) {
            console.warn('Database unavailable for chat logging:', dbError)
            // Continue without logging when database is unavailable
          }
        }
      } catch (error) {
        console.error('Failed to create chat ownership/log:', error)
        // Don't fail the request if database save fails
      }
    }

    return NextResponse.json({
      id: chatDetail.id,
      demo: chatDetail.demo,
      messages: chatDetail.messages?.map((msg) => ({
        ...msg,
        experimental_content: (msg as any).experimental_content,
      })),
    })
  } catch (error) {
    console.error('OpenRouter API Error:', error)

    // Log more detailed error information
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }

    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
