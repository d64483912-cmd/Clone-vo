import { NextRequest, NextResponse } from 'next/server'
// Note: Chat deletion is handled locally in OpenRouter integration

export async function POST(request: NextRequest) {
  try {
    const { chatId } = await request.json()

    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 },
      )
    }

    // Note: In OpenRouter integration, chats are managed locally
    // This endpoint returns success for compatibility
    const result = { success: true, chatId }

    console.log('Chat deleted successfully:', chatId)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error deleting chat:', error)
    return NextResponse.json(
      { error: 'Failed to delete chat' },
      { status: 500 },
    )
  }
}
