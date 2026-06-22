"use client"

import { useMemo, useState } from "react"
import { Sparkles, X, Search, TrendingUp } from "lucide-react"
import { ChatAssistant } from "@/components/chat-assistant"
import { ProductGrid } from "@/components/product-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Product } from "@/lib/types"

export function Storefront({ products }: { products: Product[] }) {
  const [chatOpen, setChatOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>("All")

  const categories = useMemo(() => {
    const set = Array.from(new Set(products.map((p) => p.category))).sort()
    return ["All", ...set]
  }, [products])

  const visible = useMemo(
    () => (activeCategory === "All" ? products : products.filter((p) => p.category === activeCategory)),
    [products, activeCategory],
  )

  const deals = useMemo(
    () => products.filter((p) => p.originalPrice && p.originalPrice > p.price).length,
    [products],
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            <span className="text-lg font-semibold tracking-tight">ShopSmart AI</span>
          </div>
          <Button onClick={() => setChatOpen(true)} size="sm">
            <Sparkles className="size-4" aria-hidden="true" />
            Ask the AI
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        <section className="flex flex-col items-center gap-4 py-12 text-center md:py-16">
          <Badge variant="secondary" className="gap-1">
            <TrendingUp className="size-3.5" aria-hidden="true" />
            {deals} live deals today
          </Badge>
          <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight md:text-5xl">
            Shop smarter with an AI that actually knows the catalog
          </h1>
          <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground md:text-lg">
            Describe what you need and your budget. ShopSmart AI searches real products, compares options,
            and surfaces the best deals — no endless scrolling required.
          </p>
          <Button onClick={() => setChatOpen(true)} size="lg" className="mt-2">
            <Search className="size-4" aria-hidden="true" />
            Find my perfect product
          </Button>
        </section>

        <section aria-labelledby="catalog-heading">
          <div className="flex flex-col gap-4 border-b border-border pb-4">
            <h2 id="catalog-heading" className="text-xl font-semibold">
              Browse the catalog
            </h2>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                    activeCategory === category
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:border-primary/50",
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-6">
            {visible.length ? (
              <ProductGrid className="lg:grid-cols-4" products={visible} />
            ) : (
              <p className="py-12 text-center text-muted-foreground">No products in this category yet.</p>
            )}
          </div>
        </section>
      </main>

      {/* Chat side panel */}
      <div
        aria-hidden={!chatOpen}
        className={cn(
          "fixed inset-0 z-40 bg-foreground/40 transition-opacity",
          chatOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setChatOpen(false)}
      />
      <aside
        aria-label="ShopSmart AI assistant"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card shadow-xl transition-transform duration-300",
          chatOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            <span className="font-semibold">ShopSmart Assistant</span>
          </div>
          <Button aria-label="Close assistant" onClick={() => setChatOpen(false)} size="icon" variant="ghost">
            <X className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          <ChatAssistant />
        </div>
      </aside>
    </div>
  )
}
