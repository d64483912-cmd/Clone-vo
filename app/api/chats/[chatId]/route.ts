import { NextRequest, NextResponse } from 'next/server'
import { openRouterAdapter } from '@/lib/openrouter-adapter'
import { auth } from '@/app/(auth)/auth'
import { getChatOwnership } from '@/lib/db/queries'

// Using OpenRouter adapter instead of v0 SDK

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> },
) {
  try {
    const session = await auth()
    const { chatId } = await params

    console.log('Fetching chat details for ID:', chatId)

    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 },
      )
    }

    if (session?.user?.id) {
      // Authenticated user - check ownership
      const ownership = await getChatOwnership({ v0ChatId: chatId })

      if (!ownership) {
        return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
      }

      if (ownership.user_id !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      // Anonymous user - allow access to any chat (they can only access via direct URL)
      console.log('Anonymous access to chat:', chatId)
    }

    // Fetch chat details using OpenRouter adapter
    const chatDetails = await openRouterAdapter.getChat(chatId)

    console.log('Chat details fetched:', chatDetails)

    return NextResponse.json(chatDetails)
  } catch (error) {
    console.error('Error fetching chat details:', error)

    // Log more detailed error information
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch chat details',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
