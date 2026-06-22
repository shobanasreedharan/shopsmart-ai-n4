"use client"

import { useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Sparkles, Send, ShoppingBag } from "lucide-react"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message"
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion"
import { ProductGrid } from "@/components/product-card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { Product } from "@/lib/types"

const PRODUCT_TOOLS = new Set([
  "tool-searchProducts",
  "tool-getProductsByCategory",
  "tool-compareProducts",
])

const SUGGESTIONS = [
  "Best noise-cancelling headphones under $300",
  "Compare the NimbusBook laptops",
  "A budget fitness tracker for running",
  "Show me deals in the Home category",
]

export function ChatAssistant() {
  const [input, setInput] = useState("")
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  })

  const isBusy = status === "streaming" || status === "submitted"

  function submit(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isBusy) return
    sendMessage({ text: trimmed })
    setInput("")
  }

  return (
    <div className="flex h-full flex-col">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<Sparkles className="size-8 text-primary" aria-hidden="true" />}
              title="Hi, I'm ShopSmart AI"
              description="Tell me what you're shopping for, your budget, or ask me to compare products."
            />
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, i) => {
                    if (part.type === "text") {
                      return <MessageResponse key={i}>{part.text}</MessageResponse>
                    }
                    if (PRODUCT_TOOLS.has(part.type)) {
                      const toolPart = part as { state?: string; output?: { products?: Product[] } }
                      if (toolPart.state === "output-available") {
                        const products = toolPart.output?.products ?? []
                        if (!products.length) return null
                        return <ProductGrid className="my-1" key={i} products={products} />
                      }
                      if (toolPart.state === "input-available" || toolPart.state === "input-streaming") {
                        return (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground" key={i}>
                            <Spinner className="size-4" />
                            Searching the catalog...
                          </div>
                        )
                      }
                    }
                    return null
                  })}
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Thinking...
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {messages.length === 0 && (
        <div className="px-3 pb-2">
          <Suggestions>
            {SUGGESTIONS.map((s) => (
              <Suggestion key={s} onClick={submit} suggestion={s} />
            ))}
          </Suggestions>
        </div>
      )}

      <form
        className="flex items-end gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit(input)
        }}
      >
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
          <ShoppingBag className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            aria-label="Ask ShopSmart AI"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            disabled={isBusy}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about products, budgets, or deals..."
            value={input}
          />
        </div>
        <Button aria-label="Send message" disabled={isBusy || !input.trim()} size="icon" type="submit">
          {isBusy ? <Spinner className="size-4" /> : <Send className="size-4" />}
        </Button>
      </form>
    </div>
  )
}
