'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Expense } from '@/types'
import { getApiKey } from '@/lib/storage'
import { streamChatAboutExpenses } from '@/lib/ai'
import { t, getLanguage } from '@/i18n/config'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatAssistantProps {
  expenses: Expense[]
}

export function ChatAssistant({ expenses }: ChatAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [stickToBottom, setStickToBottom] = useState(true)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const language = getLanguage()

  useEffect(() => {
    if (stickToBottom) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, stickToBottom])

  const handleScroll = () => {
    const container = scrollContainerRef.current
    if (!container) return
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    setStickToBottom(distanceFromBottom < 48)
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const apiKey = getApiKey()
    if (!apiKey) {
      alert(t('ai.noApiKey'))
      return
    }

    setStickToBottom(true)
    const messageText = input.trim()
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date()
    }

    const assistantId = (Date.now() + 1).toString()
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage, assistantMessage])
    setInput('')
    setIsLoading(true)

    try {
      let fullContent = ''

      for await (const chunk of streamChatAboutExpenses(messageText, expenses, apiKey, language)) {
        fullContent += chunk
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: fullContent } : m
        ))
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: t('common.error') } : m
      ))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion)
  }

  const exampleQuestions = language === 'my'
    ? [
        'ယခုအပတ် စားသောက်မှုအတွက် ဘယ်လောက်သုံးခဲ့လဲ။',
        'သုံးစွဲမှု အမြင့်မားဆုံး အမျိုးအစားက ဘာလဲ။',
        'ငွေချွေတာရေး အကြံပြုချက်များ ပေးပါ'
      ]
    : [
        'How much did I spend on food this week?',
        "What's my biggest expense category?",
        'Give me tips to save money'
      ]

  return (
    <Card className="flex h-[500px] flex-col border-border/40">
      <CardHeader className="flex-shrink-0 border-b border-border/30 pb-4">
        <CardTitle className="flex items-center gap-2.5 text-base">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-accent/20">
            <Lightbulb className="h-4 w-4 text-primary" />
          </span>
          {t('ai.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 pt-4">
        {/* Suggestions */}
        {messages.length === 0 && (
          <div className="mb-4 flex-shrink-0">
            <p className="text-xs font-medium text-muted-foreground mb-2.5">{t('ai.suggestions')}</p>
            <div className="flex flex-wrap gap-2">
              {exampleQuestions.map((q, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSuggestion(q)}
                  className="rounded-lg border-border/60 text-xs transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto pr-2"
          onScroll={handleScroll}
        >
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-primary to-primary/85 text-primary-foreground shadow-sm shadow-primary/20'
                      : 'bg-muted/70 text-foreground'
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.content || (isLoading && message.role === 'assistant' ? t('ai.thinking') : '')}
                  </p>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        </div>

        {/* Input */}
        <div className="flex gap-2 mt-4 flex-shrink-0">
          <Input
            placeholder={t('ai.placeholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            disabled={isLoading}
            className="rounded-xl border-border/60 bg-muted/30 transition-all focus:bg-background"
          />
          <Button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="rounded-xl bg-gradient-to-r from-primary to-primary/85 px-4 shadow-sm shadow-primary/20 transition-all hover:shadow-md hover:shadow-primary/25"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
