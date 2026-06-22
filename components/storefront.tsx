"use client"

import { useMemo, useState } from "react"
import { X, Database, ListChecks, ShoppingBag, Bot, PartyPopper, Flame, Tv, Wrench } from "lucide-react"
import { ChatAssistant, type ShoppingPlan } from "@/components/chat-assistant"
import { ProductGrid } from "@/components/product-card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Product } from "@/lib/types"

type TabId = "event-party" | "event-bbq" | "event-movie" | "diy"

const TABS: {
  id: TabId
  label: string
  icon: React.ReactNode
  title: string
  sub: string
  placeholder: string
  cta: string
  col1Label: string
  col1Placeholder?: string
  col1Options?: string[]
  col2Options: string[]
}[] = [
  {
    id: "event-party",
    label: "Event Planning",
    icon: <PartyPopper className="size-4" aria-hidden="true" />,
    title: "Plan Your Event Supplies",
    sub: "AI builds your complete event shopping list",
    placeholder: "e.g. Kids birthday party for 20 guests",
    cta: "GENERATE EVENT PLAN",
    col1Label: "Guest count",
    col1Placeholder: "e.g. 20 guests",
    col2Options: ["Under $50", "$50–$100", "$100–$250", "$250+"],
  },
  {
    id: "event-bbq",
    label: "BBQ & Outdoor",
    icon: <Flame className="size-4" aria-hidden="true" />,
    title: "Plan Your BBQ Supplies",
    sub: "AI picks everything for your outdoor cookout",
    placeholder: "e.g. Backyard BBQ for 15 people",
    cta: "GENERATE BBQ PLAN",
    col1Label: "Guest count",
    col1Placeholder: "e.g. 15 guests",
    col2Options: ["Under $50", "$50–$150", "$150–$300", "$300+"],
  },
  {
    id: "event-movie",
    label: "Movie Night",
    icon: <Tv className="size-4" aria-hidden="true" />,
    title: "Plan Your Movie Night",
    sub: "AI curates snacks, decor and comfort items",
    placeholder: "e.g. Cozy movie night for 4 people",
    cta: "GENERATE MOVIE PLAN",
    col1Label: "Guest count",
    col1Placeholder: "e.g. 4 guests",
    col2Options: ["Under $30", "$30–$75", "$75–$150", "$150+"],
  },
  {
    id: "diy",
    label: "DIY",
    icon: <Wrench className="size-4" aria-hidden="true" />,
    title: "DIY Project Supplies",
    sub: "AI finds the tools and parts you need",
    placeholder: "e.g. Fix washing machine, build a shelf, repaint walls",
    cta: "FIND DIY SUPPLIES",
    col1Label: "Skill level",
    col1Options: ["Beginner", "Intermediate", "Advanced"],
    col2Options: ["Under $50", "$50–$150", "$150–$500", "$500+"],
  },
]

const EVENT_CATS = ["All", "Decorations", "Food & Supplies", "Games & Activities", "Movie Night", "Party Favors"]
const DIY_CATS = ["All", "Plumbing", "Electrical", "Painting", "Carpentry", "Appliances"]

const EVENT_CHIPS = [
  "Kids birthday party 🎉",
  "Backyard BBQ this weekend",
  "Movie night for 4",
  "Baby shower for 20 guests",
]
const DIY_CHIPS = [
  "Fix washing machine 🔧",
  "Build a bookshelf",
  "Repaint living room",
  "Install ceiling fan",
]

export function Storefront({ products, preview = false }: { products: Product[]; preview?: boolean }) {
  const [chatOpen, setChatOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>("event-party")
  const [activeCategory, setActiveCategory] = useState<string>("All")
  const [plan, setPlan] = useState<ShoppingPlan | null>(null)
  const [activeSection, setActiveSection] = useState(0)
  const [description, setDescription] = useState("")
  const [col1Value, setCol1Value] = useState("")
  const [col2Value, setCol2Value] = useState("")

  const tab = TABS.find((t) => t.id === activeTab)!
  const isDiy = activeTab === "diy"
  const catalogCats = isDiy ? DIY_CATS : EVENT_CATS
  const chips = isDiy ? DIY_CHIPS : EVENT_CHIPS

  function handleTabChange(id: TabId) {
    setActiveTab(id)
    setActiveCategory("All")
    setDescription("")
    setCol1Value("")
    setCol2Value("")
  }

  function handlePlanReady(nextPlan: ShoppingPlan) {
    setPlan(nextPlan)
    setActiveSection(0)
    setChatOpen(false)
  }

  function clearPlan() {
    setPlan(null)
    setActiveSection(0)
    setActiveCategory("All")
  }

  function handleChipClick(chip: string) {
    const clean = chip.replace(/[🎉🔧]/g, "").trim()
    setDescription(clean)
    setChatOpen(true)
  }

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
    <div className="min-h-screen bg-[#f5f2ec]">
      {/* Preview banner */}
      {preview && (
        <div className="flex items-center justify-center gap-2 bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-800">
          <Database className="size-3.5" aria-hidden="true" />
          <span>
            Preview catalog. Connect &amp; seed DynamoDB (POST{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5">/api/seed</code>) for the live catalog.
          </span>
        </div>
      )}

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-30 bg-[#111] h-16 flex items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-md w-8 h-8 flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="size-5 text-[#111]" aria-hidden="true" />
          </div>
          <div>
            <div className="text-white text-lg font-medium tracking-tight leading-none">
              ShopSmart<span className="text-[#6dcfa0]">AI</span>
            </div>
            <div className="text-[#888] text-[10px] tracking-widest uppercase mt-0.5">
              Event &amp; DIY Intelligence
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setChatOpen(true)}
            className="border border-[#555] text-[#6dcfa0] text-xs px-4 py-1.5 rounded-md flex items-center gap-1.5 hover:bg-[#1a1a1a] transition-colors"
          >
            <Bot className="size-3.5" aria-hidden="true" /> AI AGENT
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-10">
        {/* ── PLAN CARD ── */}
        <div className="bg-white rounded-2xl border border-[#e0ddd5] px-10 py-9">
          <h1 className="text-3xl font-medium text-[#111] leading-tight" style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}>
            {tab.title}
          </h1>
          <p className="text-[#888] text-sm mt-1">{tab.sub}</p>
          <div className="w-9 h-[3px] bg-[#6dcfa0] rounded-full mt-3 mb-7" />

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap mb-7">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm border transition-all",
                  activeTab === t.id
                    ? "bg-[#111] text-white border-[#111]"
                    : "bg-[#f5f2ec] text-[#555] border-[#ddd] hover:bg-[#e8e4dc]",
                )}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Main input */}
          <label className="block text-[11px] tracking-widest uppercase text-[#999] font-medium mb-2">
            {isDiy ? "Describe your DIY task" : "Describe your event"}
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={tab.placeholder}
            className="w-full border border-[#e0ddd5] rounded-lg px-4 py-3 text-sm bg-[#f9f7f3] text-[#222] outline-none focus:border-[#6dcfa0] transition-colors"
          />

          {/* Two-col row */}
          <div className="grid grid-cols-2 gap-4 mt-5">
            <div>
              <label className="block text-[11px] tracking-widest uppercase text-[#999] font-medium mb-2">
                {tab.col1Label}
              </label>
              {tab.col1Options ? (
                <select
                  value={col1Value}
                  onChange={(e) => setCol1Value(e.target.value)}
                  className="w-full border border-[#e0ddd5] rounded-lg px-4 py-3 text-sm bg-[#f9f7f3] text-[#222] outline-none"
                >
                  {tab.col1Options.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={col1Value}
                  onChange={(e) => setCol1Value(e.target.value)}
                  placeholder={tab.col1Placeholder}
                  className="w-full border border-[#e0ddd5] rounded-lg px-4 py-3 text-sm bg-[#f9f7f3] text-[#222] outline-none focus:border-[#6dcfa0] transition-colors"
                />
              )}
            </div>
            <div>
              <label className="block text-[11px] tracking-widest uppercase text-[#999] font-medium mb-2">
                Budget
              </label>
              <select
                value={col2Value}
                onChange={(e) => setCol2Value(e.target.value)}
                className="w-full border border-[#e0ddd5] rounded-lg px-4 py-3 text-sm bg-[#f9f7f3] text-[#222] outline-none"
              >
                {tab.col2Options.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={() => setChatOpen(true)}
            className="w-full bg-[#111] text-white rounded-xl py-4 text-sm tracking-widest uppercase font-medium hover:bg-[#222] transition-colors mt-7"
          >
            ✦ {tab.cta}
          </button>
        </div>

        {/* ── CATALOG ── */}
        <section className="mt-8" aria-labelledby="catalog-heading">
          {plan ? (
            <div className="flex flex-col gap-4 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-[#f0faf5] text-[#0b6b3a]">
                    <ListChecks className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 id="catalog-heading" className="text-lg font-medium text-[#111] leading-tight">
                      {plan.title}
                    </h2>
                    <p className="text-sm text-[#888]">
                      {plan.sections.length} section{plan.sections.length === 1 ? "" : "s"} · {planTotal} item
                      {planTotal === 1 ? "" : "s"} planned by ShopSmart AI
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => setChatOpen(true)} size="sm" variant="outline">
                    Refine plan
                  </Button>
                  <Button onClick={clearPlan} size="sm" variant="ghost">
                    <X className="size-4" aria-hidden="true" /> Clear
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
                        ? "bg-[#111] text-white border-[#111]"
                        : "bg-white text-[#555] border-[#ddd] hover:border-[#999]",
                    )}
                  >
                    {section.title}
                    <span className={cn("ml-1.5 text-xs", activeSection === i ? "text-white/70" : "text-[#aaa]")}>
                      {section.products.length}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 pb-4">
              <div className="flex items-center justify-between">
                <h2 id="catalog-heading" className="text-base font-medium text-[#111]">
                  Browse the catalog
                </h2>
                <span className="text-xs bg-[#f0faf5] text-[#0b6b3a] border border-[#b5e4cc] px-3 py-1 rounded-full">
                  ⚡ {deals} live deals today
                </span>
              </div>

              {/* Category pills */}
              <div className="flex flex-wrap gap-2">
                {catalogCats.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-xs font-medium transition-colors",
                      activeCategory === cat
                        ? "bg-[#111] text-white border-[#111]"
                        : "bg-white text-[#555] border-[#ddd] hover:border-[#999]",
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4">
            {displayProducts.length ? (
              <ProductGrid className="lg:grid-cols-4" products={displayProducts} />
            ) : (
              <p className="py-12 text-center text-[#aaa] text-sm">No products in this list yet.</p>
            )}
          </div>
        </section>

        {/* ── QUICK CHIPS (below catalog) ── */}
        {!plan && (
          <div className="mt-6 bg-white rounded-2xl border border-[#e0ddd5] px-6 py-5">
            <p className="text-xs text-[#999] uppercase tracking-widest mb-3">Quick start</p>
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleChipClick(chip)}
                  className={cn(
                    "text-xs px-4 py-2 rounded-full border transition-colors",
                    isDiy
                      ? "bg-[#f0f0ff] border-[#c0c0f0] text-[#3333aa] hover:bg-[#e0e0ff]"
                      : "bg-[#f0faf5] border-[#b5e4cc] text-[#0b6b3a] hover:bg-[#dff5eb]",
                  )}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── CHAT OVERLAY ── */}
      <div
        aria-hidden={!chatOpen}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity",
          chatOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setChatOpen(false)}
      />
      <aside
        aria-label="ShopSmart AI assistant"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[#e0ddd5] bg-white shadow-xl transition-transform duration-300",
          chatOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Chat header */}
        <div className="flex items-center justify-between border-b border-[#e0ddd5] px-5 py-4">
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-[#6dcfa0]" aria-hidden="true" />
            <span className="font-medium text-[#111]">ShopSmart Assistant</span>
            {/* Mode badge */}
            <span
              className={cn(
                "text-[10px] px-2.5 py-0.5 rounded-full border flex items-center gap-1",
                isDiy
                  ? "bg-[#f0f0ff] text-[#3333aa] border-[#c0c0f0]"
                  : "bg-[#f0faf5] text-[#0b6b3a] border-[#b5e4cc]",
              )}
            >
              {isDiy ? <Wrench className="size-2.5" aria-hidden="true" /> : <PartyPopper className="size-2.5" aria-hidden="true" />}
              {isDiy ? "DIY mode" : "Event mode"}
            </span>
          </div>
          <button
            aria-label="Close assistant"
            onClick={() => setChatOpen(false)}
            className="text-[#999] hover:text-[#111] transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1">
          <ChatAssistant onPlanReady={handlePlanReady} />
        </div>
      </aside>
    </div>
  )
}
