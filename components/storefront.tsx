"use client"

import { useMemo, useState, useEffect } from "react"
import {
  X,
  Database,
  ListChecks,
  ShoppingBag,
  Bot,
  PartyPopper,
  Flame,
  Tv,
  Wrench,
} from "lucide-react"

import { ChatAssistant, type ShoppingPlan } from "@/components/chat-assistant"
import { ProductGrid } from "@/components/product-card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Product } from "@/lib/types"

type TabId = "event-party" | "event-bbq" | "event-movie" | "diy"

/* ─────────────────────────────
   CONSTANTS
───────────────────────────── */

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

const EVENT_CATS = [
  "All",
  "Decorations",
  "Food & Supplies",
  "Games & Activities",
  "Movie Night",
  "Party Favors",
]

const DIY_CATS = ["All", "Plumbing", "Electrical", "Painting", "Carpentry", "Appliances"]

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
  const [chatOpen, setChatOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>("event-party")
  const [activeCategory, setActiveCategory] = useState("All")
  const [plan, setPlan] = useState<ShoppingPlan | null>(null)
  const [activeSection, setActiveSection] = useState(0)
  const [description, setDescription] = useState("")
  const [col1Value, setCol1Value] = useState("")
  const [col2Value, setCol2Value] = useState("")

  /* ── AWS STATE ── */
  const [savedPlans, setSavedPlans] = useState<any[]>([])
  const [activePlanId, setActivePlanId] = useState<string | null>(null)

  const isDiy = activeTab === "diy"
  const catalogCats = isDiy ? DIY_CATS : EVENT_CATS
  const chips = isDiy ? DIY_CHIPS : EVENT_CHIPS

  const tab = useMemo(
    () =>
      ({
        event: "Event Planning",
      } as any),
    [],
  )

  /* ─────────────────────────────
     AWS: FETCH PLANS
  ───────────────────────────── */

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/plans")
      const data = await res.json()
      setSavedPlans(data || [])
    } catch (e) {
      console.error("Failed to fetch plans", e)
    }
  }

  useEffect(() => {
    fetchPlans()
  }, [])

  /* ─────────────────────────────
     SAVE TO AWS
  ───────────────────────────── */

  const savePlanToAWS = async () => {
    if (!plan) return

    await fetch("/api/save-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: plan.title,
        type: activeTab,
        prompt: description,
        plan,
      }),
    })

    fetchPlans()
  }

  /* ─────────────────────────────
     LOAD PLAN
  ───────────────────────────── */

  const loadPlan = (p: any) => {
    setPlan(p.plan)
    setActiveSection(0)
    setChatOpen(false)

    const id = p.planId || p.createdAt
    setActivePlanId(id)

    localStorage.setItem("lastPlanId", id)

    window.history.replaceState(null, "", `?plan=${id}`)
  }

  /* ─────────────────────────────
     RESTORE FROM URL / STORAGE
  ───────────────────────────── */

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const planId = params.get("plan")

    const last = localStorage.getItem("lastPlanId")

    const targetId = planId || last

    if (!targetId || !savedPlans.length) return

    const found = savedPlans.find(
      (p) => (p.planId || p.createdAt) === targetId,
    )

    if (found) loadPlan(found)
  }, [savedPlans])

  /* ─────────────────────────────
     DERIVED VALUES
  ───────────────────────────── */

  const planTotal = useMemo(
    () =>
      plan ? plan.sections.reduce((n, s) => n + s.products.length, 0) : 0,
    [plan],
  )

  const displayProducts = useMemo(() => {
    if (plan) return plan.sections?.[activeSection]?.products ?? []
    return activeCategory === "All"
      ? products
      : products.filter((p) => p.category === activeCategory)
  }, [plan, activeSection, products, activeCategory])

  const deals = useMemo(
    () =>
      products.filter(
        (p) => p.originalPrice && p.originalPrice > p.price,
      ).length,
    [products],
  )

  const handleGeneratePlan = async () => {
  if (!description.trim()) return

  const res = await fetch("/api/generate-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      description,
      guestCount: col1Value,
      budget: col2Value,
      type: activeTab,
    }),
  })

  if (!res.ok) {
    console.error("Failed to generate plan")
    return
  }

  const data = await res.json()

  setPlan(data.plan)
  setActiveSection(0)
}

  /* ─────────────────────────────
     RENDER
  ───────────────────────────── */

  return (
    <div className="min-h-screen bg-[#f5f2ec]">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-30 bg-[#111] h-16 flex items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-md w-8 h-8 flex items-center justify-center">
            <ShoppingBag className="size-5 text-[#111]" />
          </div>

          <div>
            <div className="text-white text-lg">
              ShopSmart<span className="text-[#6dcfa0]">AI</span>
            </div>
            <div className="text-[#888] text-[10px] uppercase">
              Event & DIY Intelligence
            </div>
          </div>
        </div>

        <button
          onClick={handleGeneratePlan}
          className="border border-[#555] text-[#6dcfa0] px-4 py-1.5 rounded-md text-xs"
        >
          <Bot className="inline size-3 mr-1" />
          AI AGENT
        </button>
      </nav>

      <main className="mx-auto max-w-3xl px-4 pt-10 pb-16">

        {/* ── PLAN CARD ── */}
        <div className="bg-white rounded-2xl border px-10 py-9">

          <h1 className="text-3xl font-medium">{tab?.title ?? "ShopSmart AI"}</h1>

          {/* Save + Controls */}
          <div className="flex gap-2 mt-4">
            <Button onClick={savePlanToAWS} size="sm">
              Save to AWS
            </Button>
          </div>

        </div>

        {/* ── MY PLANS PANEL ── */}
        {savedPlans.length > 0 && (
          <div className="mt-8 bg-white border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Database className="size-4 text-[#0b6b3a]" />
              <h3 className="font-medium">My Saved Plans</h3>
            </div>

            <div className="flex flex-col gap-2">
              {savedPlans.map((p) => {
                const id = p.planId || p.createdAt

                return (
                  <button
                    key={id}
                    onClick={() => loadPlan(p)}
                    className={cn(
                      "text-left border rounded-lg px-4 py-3 transition",
                      activePlanId === id &&
                        "bg-[#f0faf5] border-[#6dcfa0]",
                    )}
                  >
                    <div className="text-sm font-medium">{p.title}</div>
                    <div className="text-xs text-[#888]">{p.type}</div>

                    <div
                      onClick={async (e) => {
                        e.stopPropagation()
                        await fetch("/api/delete-plan", {
                          method: "POST",
                          body: JSON.stringify({ id }),
                        })
                        fetchPlans()
                      }}
                      className="text-xs text-red-500 mt-2"
                    >
                      Delete
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── PRODUCTS ── */}
        <div className="mt-8">
          {displayProducts.length ? (
            <ProductGrid products={displayProducts} />
          ) : (
            <p className="text-center text-sm text-[#aaa]">
              No products found
            </p>
          )}
        </div>

      </main>

      {/* ── CHAT ── */}
      <aside
        className={cn(
          "fixed right-0 top-0 h-full w-[400px] bg-white border-l transition",
          chatOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <ChatAssistant
          onPlanReady={(p) => {
            setPlan(p)
            setChatOpen(false)
          }}
        />
      </aside>
    </div>
  )
}