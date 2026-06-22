"use client"

import { useMemo, useState } from "react"
import { Sparkles, X, Search, TrendingUp, Database, ListChecks } from "lucide-react"
import { ChatAssistant, type ShoppingPlan } from "@/components/chat-assistant"
import { ProductGrid } from "@/components/product-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Product } from "@/lib/types"

export function Storefront({ products, preview = false }: { products: Product[]; preview?: boolean }) {
  const [chatOpen, setChatOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>("All")
  const [plan, setPlan] = useState<ShoppingPlan | null>(null)
  const [activeSection, setActiveSection] = useState(0)

  function handlePlanReady(nextPlan: ShoppingPlan) {
    setPlan(nextPlan)
    setActiveSection(0)
    // Reveal the refreshed catalog behind the chat panel.
    setChatOpen(false)
  }

  function clearPlan() {
    setPlan(null)
    setActiveSection(0)
    setActiveCategory("All")
  }

  const categories = useMemo(() => {
    const set = Array.from(new Set(products.map((p) => p.category))).sort()
    return ["All", ...set]
  }, [products])

  const planTotal = useMemo(
    () => (plan ? plan.sections.reduce((n, s) => n + s.products.length, 0) : 0),
    [plan],
  )

  const displayProducts = useMemo(() => {
    if (plan) return plan.sections[activeSection]?.products ?? []
    return activeCategory === "All" ? products : products.filter((p) => p.category === activeCategory)
  }, [plan, activeSection, products, activeCategory])

  const deals = useMemo(
    () => products.filter((p) => p.originalPrice && p.originalPrice > p.price).length,
    [products],
  )

  return (
    <div className="min-h-screen bg-background">
      {preview && (
        <div className="flex items-center justify-center gap-2 bg-primary/10 px-4 py-2 text-center text-xs text-foreground">
          <Database className="size-3.5 text-primary" aria-hidden="true" />
          <span>
            Preview catalog. Connect &amp; seed DynamoDB (POST{" "}
            <code className="rounded bg-muted px-1 py-0.5">/api/seed</code>) for the live catalog.
          </span>
        </div>
      )}
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
            Plan your whole event with an AI that builds the shopping list
          </h1>
          <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground md:text-lg">
            Tell ShopSmart AI about your party, BBQ, or movie night. It asks a few quick questions, then
            fills your catalog with decorations, food supplies, favors, games, and more — ready to shop.
          </p>
          <Button onClick={() => setChatOpen(true)} size="lg" className="mt-2">
            <Search className="size-4" aria-hidden="true" />
            Plan my event
          </Button>
        </section>

        <section aria-labelledby="catalog-heading">
          {plan ? (
            <div className="flex flex-col gap-4 border-b border-border pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ListChecks className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 id="catalog-heading" className="text-xl font-semibold leading-tight">
                      {plan.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {plan.sections.length} list{plan.sections.length === 1 ? "" : "s"} · {planTotal} item
                      {planTotal === 1 ? "" : "s"} planned by ShopSmart AI
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => setChatOpen(true)} size="sm" variant="outline">
                    <Sparkles className="size-4" aria-hidden="true" />
                    Refine plan
                  </Button>
                  <Button onClick={clearPlan} size="sm" variant="ghost">
                    <X className="size-4" aria-hidden="true" />
                    Clear
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {plan.sections.map((section, i) => (
                  <button
                    key={section.title}
                    onClick={() => setActiveSection(i)}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                      activeSection === i
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:border-primary/50",
                    )}
                  >
                    {section.title}
                    <span
                      className={cn(
                        "ml-1.5 text-xs",
                        activeSection === i ? "text-primary-foreground/80" : "text-muted-foreground",
                      )}
                    >
                      {section.products.length}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
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
          )}

          <div className="pt-6">
            {displayProducts.length ? (
              <ProductGrid className="lg:grid-cols-4" products={displayProducts} />
            ) : (
              <p className="py-12 text-center text-muted-foreground">No products in this list yet.</p>
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
          <ChatAssistant onPlanReady={handlePlanReady} />
        </div>
      </aside>
    </div>
  )
}
