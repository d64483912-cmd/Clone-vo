import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json()

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      )
    }

    // Test the API key by making a simple request to OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Invalid API key or unauthorized' },
          { status: 401 }
        )
      }
      throw new Error(`OpenRouter API error: ${response.status}`)
    }

    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      message: 'API key is valid',
      modelCount: data.data?.length || 0
    })

  } catch (error) {
    console.error('Error testing OpenRouter API key:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to test API key'
      },
      { status: 500 }
    )
  }
}