'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Settings, Eye, EyeOff, ExternalLink, Loader } from 'lucide-react'
import Link from 'next/link'

interface OpenRouterModel {
  id: string
  name: string
  context_length: number
  pricing: {
    prompt: string
    completion: string
  }
}

export function OpenRouterSettings() {
  const [isOpen, setIsOpen] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [models, setModels] = useState<OpenRouterModel[]>([])
  const [showApiKey, setShowApiKey] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)

  // Load saved settings from localStorage
  useEffect(() => {
    const savedApiKey = localStorage.getItem('openrouter_api_key')
    const savedModel = localStorage.getItem('openrouter_selected_model')
    
    if (savedApiKey) {
      setApiKey(savedApiKey)
    }
    if (savedModel) {
      setSelectedModel(savedModel)
    }
  }, [])

  // Load free models when API key is provided
  useEffect(() => {
    if (apiKey && apiKey.startsWith('sk-or-')) {
      loadFreeModels()
    }
  }, [apiKey])

  const loadFreeModels = async () => {
    setLoadingModels(true)
    try {
      const response = await fetch('/api/openrouter/models')
      if (response.ok) {
        const data = await response.json()
        setModels(data.freeModels || [])
      } else {
        console.error('Failed to load models')
      }
    } catch (error) {
      console.error('Error loading models:', error)
    } finally {
      setLoadingModels(false)
    }
  }

  const handleApiKeyChange = (value: string) => {
    setApiKey(value)
    if (value) {
      localStorage.setItem('openrouter_api_key', value)
    } else {
      localStorage.removeItem('openrouter_api_key')
    }
  }

  const handleModelChange = (value: string) => {
    setSelectedModel(value)
    localStorage.setItem('openrouter_selected_model', value)
  }

  const handleSave = () => {
    setIsLoading(true)
    // Simulate saving process
    setTimeout(() => {
      setIsLoading(false)
      setIsOpen(false)
    }, 500)
  }

  const handleTestApiKey = async () => {
    if (!apiKey) return
    
    setIsLoading(true)
    try {
      const response = await fetch('/api/openrouter/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      })
      
      if (response.ok) {
        alert('API key is valid!')
      } else {
        const error = await response.json()
        alert(`API key test failed: ${error.message}`)
      }
    } catch (error) {
      alert('Failed to test API key')
    } finally {
      setIsLoading(false)
    }
  }

  const hasValidApiKey = apiKey && apiKey.startsWith('sk-or-')

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 py-1 text-sm"
        >
          <Settings size={14} className="mr-1" />
          OpenRouter
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>OpenRouter Settings</DialogTitle>
          <DialogDescription>
            Configure your OpenRouter API key and select from free models
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* API Key Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">API Key</label>
            <div className="relative">
              <Input
                type={showApiKey ? 'text' : 'password'}
                placeholder="sk-or-v1-..."
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <EyeOff size={16} className="text-gray-500" />
                ) : (
                  <Eye size={16} className="text-gray-500" />
                )}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleTestApiKey}
                disabled={!hasValidApiKey || isLoading}
              >
                {isLoading ? <Loader size={14} className="animate-spin" /> : 'Test Key'}
              </Button>
              <Link 
                href="https://openrouter.ai/keys" 
                target="_blank" 
                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
              >
                Get API Key <ExternalLink size={12} className="ml-1" />
              </Link>
            </div>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            <Select 
              value={selectedModel} 
              onValueChange={handleModelChange}
              disabled={!hasValidApiKey}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  !hasValidApiKey 
                    ? "Enter API key first" 
                    : loadingModels 
                      ? "Loading models..." 
                      : "Select a free model"
                } />
              </SelectTrigger>
              <SelectContent>
                {loadingModels && (
                  <SelectItem value="loading" disabled>
                    <div className="flex items-center">
                      <Loader size={14} className="animate-spin mr-2" />
                      Loading models...
                    </div>
                  </SelectItem>
                )}
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{model.name}</span>
                      <span className="text-xs text-gray-500">
                        Context: {model.context_length.toLocaleString()} tokens
                      </span>
                    </div>
                  </SelectItem>
                ))}
                {models.length === 0 && !loadingModels && hasValidApiKey && (
                  <SelectItem value="no-models" disabled>
                    No free models available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="text-xs text-gray-600 bg-gray-50 dark:bg-gray-800 p-3 rounded">
            {!hasValidApiKey && (
              <p>💡 Enter your OpenRouter API key to access free AI models</p>
            )}
            {hasValidApiKey && !selectedModel && (
              <p>✅ API key configured. Select a model to get started.</p>
            )}
            {hasValidApiKey && selectedModel && (
              <p>🚀 Ready to use {models.find(m => m.id === selectedModel)?.name || selectedModel}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={isLoading}
            >
              {isLoading ? <Loader size={14} className="animate-spin mr-2" /> : null}
              Save Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}