import { NextRequest, NextResponse } from 'next/server'
import { openRouterAdapter } from '@/lib/openrouter-adapter'
import { auth } from '@/app/(auth)/auth'
import { getChatIdsByUserId } from '@/lib/db/queries'

// Using OpenRouter adapter instead of v0 SDK

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    // Anonymous users don't have saved chats
    if (!session?.user?.id) {
      return NextResponse.json({ data: [] })
    }

    console.log('Fetching chats for user:', session.user.id)

    // Get user's chat IDs from our ownership mapping
    const userChatIds = await getChatIdsByUserId({ userId: session.user.id })

    if (userChatIds.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Fetch actual chat data from OpenRouter adapter
    const allChats = await openRouterAdapter.listChats()

    // Filter to only include chats owned by this user
    const userChats =
      allChats.data?.filter((chat) => userChatIds.includes(chat.id)) || []

    console.log('Chats fetched successfully:', userChats.length, 'chats')

    return NextResponse.json({ data: userChats })
  } catch (error) {
    console.error('Chats fetch error:', error)

    // Log more detailed error information
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch chats',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
