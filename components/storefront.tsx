"use client"

import { useMemo, useState, useEffect } from "react"
import {
  X, Database, ListChecks, ShoppingBag, Bot,
  PartyPopper, Flame, Tv, Wrench, Star, Loader2,
  ExternalLink, ShoppingCart,
} from "lucide-react"
import { ChatAssistant, type ShoppingPlan } from "@/components/chat-assistant"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Product } from "@/lib/types"

/* ─────────────────────────────
   TYPES
───────────────────────────── */

type TabId = "event-party" | "event-bbq" | "event-movie" | "diy"

interface AmazonProduct {
  asin: string
  name: string
  brand: string
  price: number
  originalPrice: number | null
  rating: number
  reviewCount: number
  imageUrl: string
  amazonUrl: string
  inStock: boolean
  badge: string | null
}

interface GeneratedSection {
  title: string
  products: AmazonProduct[]
}

interface GeneratedPlan {
  title: string
  type: string
  sections: GeneratedSection[]
}

/* ─────────────────────────────
   TAB CONFIG
───────────────────────────── */

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
    icon: <PartyPopper className="size-4" />,
    title: "Plan Your Event or DIY Supplies",
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
    icon: <Flame className="size-4" />,
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
    icon: <Tv className="size-4" />,
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
    icon: <Wrench className="size-4" />,
    title: "DIY Project Supplies",
    sub: "AI finds the tools and parts you need",
    placeholder: "e.g. Fix washing machine, build a shelf, repaint walls",
    cta: "FIND DIY SUPPLIES",
    col1Label: "Skill level",
    col1Options: ["Beginner", "Intermediate", "Advanced"],
    col2Options: ["Under $50", "$50–$150", "$150–$500", "$500+"],
  },
]

const EVENT_CHIPS = ["Kids birthday party 🎉", "Backyard BBQ this weekend", "Movie night for 4", "Baby shower for 20 guests"]
const DIY_CHIPS   = ["Fix washing machine 🔧", "Build a bookshelf", "Repaint living room", "Install ceiling fan"]

/* ─────────────────────────────
   STAR RATING
───────────────────────────── */

function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={cn(
              "size-3",
              s <= Math.round(rating)
                ? "fill-[#f5a623] text-[#f5a623]"
                : "fill-[#e0ddd5] text-[#e0ddd5]",
            )}
          />
        ))}
      </div>
      <span className="text-[11px] text-[#888]">
        {rating.toFixed(1)} ({count.toLocaleString()})
      </span>
    </div>
  )
}

/* ─────────────────────────────
   AMAZON PRODUCT CARD
───────────────────────────── */

function AmazonCard({ product }: { product: AmazonProduct }) {
  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : null

  return (
    <div className="bg-white rounded-xl border border-[#e0ddd5] p-4 flex flex-col gap-3 hover:border-[#6dcfa0] hover:shadow-sm transition-all group">
      {/* Image area */}
      <div className="relative bg-[#f9f7f3] rounded-lg h-36 flex items-center justify-center overflow-hidden">
        {product.badge && (
          <span className="absolute top-2 left-2 bg-[#111] text-white text-[9px] font-medium px-2 py-0.5 rounded-full">
            {product.badge}
          </span>
        )}
        {discount && (
          <span className="absolute top-2 right-2 bg-[#c0392b] text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
            -{discount}%
          </span>
        )}
        {/* Placeholder illustration */}
        <ShoppingCart className="size-10 text-[#ddd]" />
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1.5 flex-1">
        <div className="text-[10px] text-[#aaa] uppercase tracking-wide">{product.brand}</div>
        <div className="text-sm font-medium text-[#111] leading-snug line-clamp-2">{product.name}</div>
        <StarRating rating={product.rating} count={product.reviewCount} />
      </div>

      {/* Price + CTA */}
      <div className="flex items-center justify-between pt-1 border-t border-[#f0ede6]">
        <div>
          <span className="text-lg font-semibold text-[#111]">${product.price.toFixed(2)}</span>
          {product.originalPrice && (
            <span className="ml-1.5 text-xs text-[#bbb] line-through">${product.originalPrice.toFixed(2)}</span>
          )}
        </div>
        <a
          href={product.amazonUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs bg-[#f5a623] hover:bg-[#e09010] text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
        >
          Amazon <ExternalLink className="size-3" />
        </a>
      </div>

      {!product.inStock && (
        <p className="text-[10px] text-red-400 font-medium -mt-1">Out of stock</p>
      )}
    </div>
  )
}

/* ─────────────────────────────
   COMPONENT
───────────────────────────── */

export function Storefront({
  products,
  preview = false,
}: {
  products: Product[]
  preview?: boolean
}) {
  /* ── UI STATE ── */
  const [chatOpen, setChatOpen]             = useState(false)
  const [activeTab, setActiveTab]           = useState<TabId>("event-party")
  const [description, setDescription]       = useState("")
  const [col1Value, setCol1Value]           = useState("")
  const [col2Value, setCol2Value]           = useState("")

  /* ── GENERATED PLAN STATE ── */
  const [generatedPlan, setGeneratedPlan]   = useState<GeneratedPlan | null>(null)
  const [activeSection, setActiveSection]   = useState(0)
  const [generating, setGenerating]         = useState(false)
  const [generateError, setGenerateError]   = useState<string | null>(null)
  const [planSource, setPlanSource]         = useState<"cache" | "ai" | null>(null)

  /* ── CHAT PLAN STATE (legacy fallback) ── */
  const [chatPlan, setChatPlan]             = useState<ShoppingPlan | null>(null)

  /* ── AWS SAVED PLANS ── */
  const [savedPlans, setSavedPlans]         = useState<any[]>([])
  const [activePlanId, setActivePlanId]     = useState<string | null>(null)

  const isDiy       = activeTab === "diy"
  const chips       = isDiy ? DIY_CHIPS : EVENT_CHIPS
  const tab         = TABS.find((t) => t.id === activeTab)!
  const activePlan  = generatedPlan ?? null

  /* ─────────────────────────────
     AWS PLANS
  ───────────────────────────── */

  const fetchPlans = async () => {
    try {
      const res  = await fetch("/api/plans")
      const data = await res.json()
      setSavedPlans(data || [])
    } catch (e) {
      console.error("Failed to fetch plans", e)
    }
  }

  useEffect(() => { fetchPlans() }, [])

  const savePlanToAWS = async () => {
    if (!generatedPlan) return
    await fetch("/api/save-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: generatedPlan.title, type: activeTab, prompt: description, plan: generatedPlan }),
    })
    fetchPlans()
  }

  const deletePlan = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await fetch("/api/delete-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    if (activePlanId === id) {
      setGeneratedPlan(null)
      setActivePlanId(null)
      window.history.replaceState(null, "", "/")
    }
    fetchPlans()
  }

  const loadSavedPlan = (p: any) => {
    setGeneratedPlan(p.plan)
    setActiveSection(0)
    setChatOpen(false)
    const id = p.planId || p.createdAt
    setActivePlanId(id)
    localStorage.setItem("lastPlanId", id)
    window.history.replaceState(null, "", `?plan=${id}`)
  }

  useEffect(() => {
    if (!savedPlans.length) return
    const params   = new URLSearchParams(window.location.search)
    const planId   = params.get("plan") || localStorage.getItem("lastPlanId")
    if (!planId) return
    const found = savedPlans.find((p) => (p.planId || p.createdAt) === planId)
    if (found) loadSavedPlan(found)
  }, [savedPlans])

  /* ─────────────────────────────
     GENERATE PLAN
  ───────────────────────────── */

  const handleGenerate = async () => {
    if (!description.trim()) return
    setGenerating(true)
    setGenerateError(null)
    setGeneratedPlan(null)
    setActiveSection(0)

    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          type: activeTab,
          guestCount: col1Value,
          budget: col2Value,
        }),
      })

      if (!res.ok) throw new Error("Failed to generate plan")

      const data = await res.json()
      setGeneratedPlan(data.plan)
      setPlanSource(data.source)
      setActiveSection(0)
    } catch (err) {
      setGenerateError("Something went wrong. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  /* ─────────────────────────────
     HANDLERS
  ───────────────────────────── */

  function handleTabChange(id: TabId) {
    setActiveTab(id)
    setDescription("")
    setCol1Value("")
    setCol2Value("")
    setGeneratedPlan(null)
    setGenerateError(null)
    setPlanSource(null)
  }

  function clearPlan() {
    setGeneratedPlan(null)
    setChatPlan(null)
    setActiveSection(0)
    setActivePlanId(null)
    setPlanSource(null)
    localStorage.removeItem("lastPlanId")
    window.history.replaceState(null, "", "/")
  }

  function handleChipClick(chip: string) {
    setDescription(chip.replace(/[🎉🔧]/g, "").trim())
  }

  /* ─────────────────────────────
     DERIVED
  ───────────────────────────── */

  const currentSection = activePlan?.sections?.[activeSection]
  const sectionProducts: AmazonProduct[] = currentSection?.products ?? []

  const deals = useMemo(
    () => products.filter((p) => p.originalPrice && p.originalPrice > p.price).length,
    [products],
  )

  /* ─────────────────────────────
     RENDER
  ───────────────────────────── */

  return (
    <div className="min-h-screen bg-[#f5f2ec]">

      {/* ── PREVIEW BANNER ── */}
      {preview && (
        <div className="flex items-center justify-center gap-2 bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800">
          <Database className="size-3.5" />
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
            <ShoppingBag className="size-5 text-[#111]" />
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
        <button
          onClick={() => setChatOpen(true)}
          className="border border-[#555] text-[#6dcfa0] text-xs px-4 py-1.5 rounded-md flex items-center gap-1.5 hover:bg-[#1a1a1a] transition-colors"
        >
          <Bot className="size-3.5" /> AI AGENT
        </button>
      </nav>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-10">

        {/* ── PLAN CARD ── */}
        <div className="bg-white rounded-2xl border border-[#e0ddd5] px-10 py-9">
          <h1
            className="text-3xl font-medium text-[#111] leading-tight"
            style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
          >
            {tab.title}
          </h1>
          <p className="text-[#888] text-sm mt-1">{tab.sub}</p>
          <div className="w-9 h-[3px] bg-[#6dcfa0] rounded-full mt-3 mb-7" />

          {/* Mode tabs */}
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

          {/* Description input */}
          <label className="block text-[11px] tracking-widest uppercase text-[#999] font-medium mb-2">
            {isDiy ? "Describe your DIY task" : "Describe your event"}
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
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
            onClick={handleGenerate}
            disabled={generating || !description.trim()}
            className={cn(
              "w-full rounded-xl py-4 text-sm tracking-widest uppercase font-medium transition-colors mt-7 flex items-center justify-center gap-2",
              generating || !description.trim()
                ? "bg-[#555] text-[#999] cursor-not-allowed"
                : "bg-[#111] text-white hover:bg-[#222]",
            )}
          >
            {generating ? (
              <><Loader2 className="size-4 animate-spin" /> Finding your supplies…</>
            ) : (
              <>✦ {tab.cta}</>
            )}
          </button>

          {/* Error */}
          {generateError && (
            <p className="text-xs text-red-500 mt-3 text-center">{generateError}</p>
          )}

          {/* Save to AWS */}
          {generatedPlan && (
            <button
              onClick={savePlanToAWS}
              className="w-full mt-3 border border-[#6dcfa0] text-[#0b6b3a] bg-[#f0faf5] rounded-xl py-3 text-sm tracking-widest uppercase font-medium hover:bg-[#dff5eb] transition-colors"
            >
              ↑ Save Plan to AWS
            </button>
          )}
        </div>

        {/* ── QUICK START CHIPS ── */}
        {!generatedPlan && (
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

        {/* ── GENERATED PLAN RESULTS ── */}
        {generatedPlan && (
          <section className="mt-8" aria-labelledby="catalog-heading">

            {/* Plan header */}
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-[#f0faf5] text-[#0b6b3a]">
                  <ListChecks className="size-4" />
                </span>
                <div>
                  <h2 id="catalog-heading" className="text-lg font-medium text-[#111] leading-tight">
                    {generatedPlan.title}
                  </h2>
                  <p className="text-xs text-[#888] mt-0.5 flex items-center gap-1.5">
                    {generatedPlan.sections.length} categories ·{" "}
                    {generatedPlan.sections.reduce((n, s) => n + s.products.length, 0)} items
                    {planSource === "cache" && (
                      <span className="bg-[#f0faf5] text-[#0b6b3a] border border-[#b5e4cc] text-[10px] px-2 py-0.5 rounded-full">
                        ✓ From cache
                      </span>
                    )}
                    {planSource === "ai" && (
                      <span className="bg-[#f0f0ff] text-[#3333aa] border border-[#c0c0f0] text-[10px] px-2 py-0.5 rounded-full">
                        ✦ AI generated
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => setChatOpen(true)} size="sm" variant="outline">
                  Refine with AI
                </Button>
                <Button onClick={clearPlan} size="sm" variant="ghost">
                  <X className="size-4" /> Clear
                </Button>
              </div>
            </div>

            {/* Section tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {generatedPlan.sections.map((section, i) => (
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

            {/* Section heading */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-medium text-[#111]">
                {currentSection?.title}
              </h3>
              <span className="text-xs text-[#888]">
                Showing {sectionProducts.length} items from Amazon
              </span>
            </div>

            {/* Amazon product grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {sectionProducts.map((product) => (
                <AmazonCard key={product.asin} product={product} />
              ))}
            </div>

          </section>
        )}

        {/* ── MY SAVED PLANS ── */}
        {savedPlans.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl border border-[#e0ddd5] px-6 py-5">
            <div className="flex items-center gap-2 mb-4">
              <Database className="size-4 text-[#0b6b3a]" />
              <h3 className="text-sm font-medium text-[#111]">My Saved Plans</h3>
            </div>
            <div className="flex flex-col gap-2">
              {savedPlans.map((p) => {
                const id = p.planId || p.createdAt
                return (
                  <button
                    key={id}
                    onClick={() => loadSavedPlan(p)}
                    className={cn(
                      "text-left border rounded-xl px-4 py-3 transition-colors w-full",
                      activePlanId === id
                        ? "bg-[#f0faf5] border-[#6dcfa0]"
                        : "border-[#e0ddd5] hover:border-[#aaa] bg-[#f9f7f3]",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-[#111]">{p.title}</div>
                        <div className="text-xs text-[#888] mt-0.5 capitalize">
                          {p.type?.replace(/-/g, " ")}
                        </div>
                      </div>
                      <span
                        onClick={(e) => deletePlan(e, id)}
                        className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 rounded-md px-2 py-1 transition-colors"
                      >
                        Delete
                      </span>
                    </div>
                  </button>
                )
              })}
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
        <div className="flex items-center justify-between border-b border-[#e0ddd5] px-5 py-4">
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-[#6dcfa0]" />
            <span className="font-medium text-[#111]">ShopSmart Assistant</span>
            <span
              className={cn(
                "text-[10px] px-2.5 py-0.5 rounded-full border flex items-center gap-1",
                isDiy
                  ? "bg-[#f0f0ff] text-[#3333aa] border-[#c0c0f0]"
                  : "bg-[#f0faf5] text-[#0b6b3a] border-[#b5e4cc]",
              )}
            >
              {isDiy
                ? <><Wrench className="size-2.5" /> DIY mode</>
                : <><PartyPopper className="size-2.5" /> Event mode</>
              }
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
          <ChatAssistant
            onPlanReady={(p) => {
              setChatPlan(p)
              setChatOpen(false)
            }}
          />
        </div>
      </aside>
    </div>
  )
}
