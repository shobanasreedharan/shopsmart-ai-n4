"use client"

import { useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Sparkles, Send, ShoppingBag, ListChecks, AlertTriangle } from "lucide-react"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message"
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { Product } from "@/lib/types"

// Tools whose results power the catalog (never rendered as cards in chat).
const SEARCH_TOOLS = new Set([
  "tool-searchProducts",
  "tool-getProductsByCategory",
  "tool-compareProducts",
])

export type PlanSection = { title: string; products: Product[] }
export type ShoppingPlan = { title: string; sections: PlanSection[] }

type PlanOutput = { title?: string; sections?: PlanSection[] }

function extractPlan(message: { parts?: { type: string }[] }): ShoppingPlan | null {
  const part = message.parts?.find(
    (p) => p.type === "tool-buildPlanCatalog" && (p as { state?: string }).state === "output-available",
  ) as { output?: PlanOutput } | undefined
  const output = part?.output
  if (output?.sections?.length) {
    return { title: output.title ?? "Your plan", sections: output.sections }
  }
  return null
}

const SUGGESTIONS = [
  "Plan a kids birthday party",
  "Backyard BBQ this weekend",
  "Cozy movie night at home",
  "A baby shower for 20 guests",
]

export function ChatAssistant({ onPlanReady }: { onPlanReady?: (plan: ShoppingPlan) => void }) {
  const [input, setInput] = useState("")
  const { messages, sendMessage, status, error, regenerate } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onFinish: ({ message }) => {
      const plan = extractPlan(message)
      if (plan) onPlanReady?.(plan)
    },
  })

  const isBusy = status === "streaming" || status === "submitted"
  const isRateLimited = /rate.?limit|429/i.test(error?.message ?? "")

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
                    if (part.type === "tool-buildPlanCatalog") {
                      const planPart = part as { state?: string; output?: PlanOutput }
                      if (planPart.state === "output-available") {
                        const sections = planPart.output?.sections ?? []
                        if (!sections.length) return null
                        const total = sections.reduce((n, s) => n + s.products.length, 0)
                        return (
                          <div
                            className="my-1 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm font-medium"
                            key={i}
                          >
                            <ListChecks className="size-4 shrink-0 text-primary" aria-hidden="true" />
                            <span>
                              Catalog updated: {sections.length} section{sections.length === 1 ? "" : "s"},{" "}
                              {total} item{total === 1 ? "" : "s"}. Close this panel to browse.
                            </span>
                          </div>
                        )
                      }
                      if (planPart.state === "input-available" || planPart.state === "input-streaming") {
                        return (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground" key={i}>
                            <Spinner className="size-4" />
                            Building your catalog...
                          </div>
                        )
                      }
                      return null
                    }
                    // Search tools power the catalog, not the chat — show a quiet
                    // progress hint while the assistant looks things up.
                    if (SEARCH_TOOLS.has(part.type)) {
                      const toolPart = part as { state?: string }
                      if (toolPart.state === "input-available" || toolPart.state === "input-streaming") {
                        return (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground" key={i}>
                            <Spinner className="size-4" />
                            Finding products...
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
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-destructive">
                <AlertTriangle className="size-4" aria-hidden="true" />
                {isRateLimited ? "Rate limit reached" : "Something went wrong"}
              </div>
              <p className="mt-1 text-muted-foreground">
                {isRateLimited
                  ? "The AI model is rate-limited on the free tier. Add AI Gateway credits, then retry."
                  : "I couldn't finish that response. Please try again."}
              </p>
              <Button className="mt-2" onClick={() => regenerate()} size="sm" variant="outline">
                Retry
              </Button>
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
