import { NextResponse } from "next/server"
import { seedProducts, getAllProducts } from "@/lib/db"
import { SEED_PRODUCTS } from "@/lib/seed-data"

export const maxDuration = 30

// POST /api/seed — populate the DynamoDB table with the starter catalog.
export async function POST() {
  try {
    const count = await seedProducts(SEED_PRODUCTS)
    return NextResponse.json({ ok: true, seeded: count })
  } catch (error) {
    console.error("[v0] seed error:", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

// GET /api/seed — report how many products currently exist.
export async function GET() {
  try {
    const products = await getAllProducts()
    return NextResponse.json({ ok: true, count: products.length })
  } catch (error) {
    console.error("[v0] seed status error:", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
