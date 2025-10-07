import { NextResponse } from 'next/server'

interface OpenRouterModel {
  id: string
  name: string
  context_length: number
  pricing: {
    prompt: string
    completion: string
  }
  per_request_limits?: {
    prompt_tokens?: string
    completion_tokens?: string
  }
}

export async function GET() {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`)
    }

    const data = await response.json()
    
    // Filter for free models (models with 0 cost)
    const freeModels = data.data?.filter((model: OpenRouterModel) => {
      const promptPrice = parseFloat(model.pricing.prompt)
      const completionPrice = parseFloat(model.pricing.completion)
      return promptPrice === 0 && completionPrice === 0
    }) || []

    // Sort by name for better UX
    freeModels.sort((a: OpenRouterModel, b: OpenRouterModel) => a.name.localeCompare(b.name))

    return NextResponse.json({
      freeModels: freeModels.map((model: OpenRouterModel) => ({
        id: model.id,
        name: model.name,
        context_length: model.context_length,
        pricing: model.pricing,
      }))
    })

  } catch (error) {
    console.error('Error fetching OpenRouter models:', error)
    
    // Return some default free models as fallback
    const fallbackModels = [
      {
        id: 'deepseek/deepseek-chat-v3.1:free',
        name: 'DeepSeek Chat v3.1 (Free)',
        context_length: 65536,
        pricing: { prompt: '0', completion: '0' }
      },
      {
        id: 'google/gemini-flash-1.5:free',
        name: 'Gemini Flash 1.5 (Free)',
        context_length: 1000000,
        pricing: { prompt: '0', completion: '0' }
      },
      {
        id: 'meta-llama/llama-3.2-3b-instruct:free',
        name: 'Llama 3.2 3B Instruct (Free)',
        context_length: 131072,
        pricing: { prompt: '0', completion: '0' }
      }
    ]

    return NextResponse.json({
      freeModels: fallbackModels
    })
  }
}