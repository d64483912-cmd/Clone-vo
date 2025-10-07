import { NextRequest, NextResponse } from 'next/server'
import { openRouterAdapter } from '@/lib/openrouter-adapter'
import { nanoid } from 'nanoid'

export async function POST(request: NextRequest) {
  try {
    const { chatId } = await request.json()

    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 },
      )
    }

    // Fork the chat using OpenRouter adapter
    const originalChat = await openRouterAdapter.getChat(chatId)
    
    if (!originalChat) {
      return NextResponse.json({ error: 'Original chat not found' }, { status: 404 })
    }
    
    // Create a copy of the chat with new ID
    const forkedChat = {
      ...originalChat,
      id: nanoid(),
      created_at: Date.now(),
      updated_at: Date.now(),
    }

    console.log('Chat forked successfully:', forkedChat.id)

    return NextResponse.json(forkedChat)
  } catch (error) {
    console.error('Error forking chat:', error)
    return NextResponse.json({ error: 'Failed to fork chat' }, { status: 500 })
  }
}
