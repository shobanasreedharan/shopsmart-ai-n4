import { streamText, convertToModelMessages, tool, stepCountIs, type UIMessage } from "ai"
import { z } from "zod"
import { searchProducts, getProductsByCategory, getCategories, getProductById } from "@/lib/db"
import type { Product } from "@/lib/types"

export const maxDuration = 30

const SYSTEM_PROMPT = `You are ShopSmart AI, a friendly shopping planner for a catalog of tech products.
The catalog ONLY contains these categories: Headphones, Laptops, Wearables, Monitors, Home.

IMPORTANT — Keep chat clean. NEVER recommend, list, name, or describe individual products in the chat. Never paste product names, specs, prices, or "options" into the conversation. All products are shown to the shopper in the main catalog on the page, never in chat. Your chat replies are short and conversational only.

Help the shopper plan for an occasion or project (e.g. "kids birthday party", "home office setup", "gifts for a runner"). Follow this STRICT three-step flow:

STEP 1 — The user's first message describes the occasion. Ask 2-4 SHORT clarifying questions in ONE message as a compact bulleted list (e.g. age group, number of guests, indoor or outdoor, budget, theme/interests). Do NOT call any tools.

STEP 2 — The user answers your questions. Reply with a SHORT numbered list of the TYPES of items needed for the occasion. These are section/category names, NOT specific products. Example:
"Here's what I'd plan for a kids party:
1. Party music & audio
2. A standout gift
3. Smart home extras"
Keep it to 3-5 items. Then ask the user to confirm, e.g. "Want me to build this into your catalog? Reply 'ok' to continue." Do NOT call any tools. Do NOT name specific products.

STEP 3 — The user confirms (e.g. "ok", "yes", "go ahead"). Now build it:
  a. Use searchProducts (at most 3 calls) to find REAL catalog products for each section. Substitute the closest items we carry for things we don't sell (e.g. earbuds/headphones for "music", a smartwatch or fitness band as a gift, a smart coffee maker or other Home items for ambiance/extras).
  b. Call buildPlanCatalog EXACTLY ONCE. Provide the occasion title and 3-5 sections; each section has a short title (matching your step-2 list) and 1-4 real products (by category + productId). Skip any section you cannot fill with real catalog products.
  c. After the tool call, reply with ONE short sentence confirming the catalog is ready (e.g. "Done — your Kids Birthday Party catalog is ready below."). Do NOT list products.

Never show products in chat. Never skip the step-2 list or the confirmation. Once confirmed, you MUST call buildPlanCatalog.`

const tools = {
  searchProducts: tool({
    description:
      "Search the product catalog by keyword, category, price ceiling, minimum rating, and/or tags. Use this for most shopping requests.",
    inputSchema: z.object({
      query: z.string().nullable().describe("Keyword to match against name, brand, description, features, tags"),
      category: z
        .string()
        .nullable()
        .describe("One of: Headphones, Laptops, Wearables, Monitors, Home"),
      maxPrice: z.number().nullable().describe("Maximum price in USD"),
      minRating: z.number().nullable().describe("Minimum average rating, 0-5"),
      tags: z.array(z.string()).nullable().describe("Tags to match, e.g. budget, premium, gaming, travel"),
    }),
    execute: async ({ query, category, maxPrice, minRating, tags }) => {
      const products = await searchProducts({
        query: query ?? undefined,
        category: category ?? undefined,
        maxPrice: maxPrice ?? undefined,
        minRating: minRating ?? undefined,
        tags: tags ?? undefined,
      })
      return { count: products.length, products }
    },
  }),
  getProductsByCategory: tool({
    description: "List all products within a specific category.",
    inputSchema: z.object({
      category: z.string().describe("One of: Headphones, Laptops, Wearables, Monitors, Home"),
    }),
    execute: async ({ category }) => {
      const products = await getProductsByCategory(category)
      return { count: products.length, products }
    },
  }),
  compareProducts: tool({
    description:
      "Fetch two or more specific products by their category and productId so they can be compared side by side.",
    inputSchema: z.object({
      items: z
        .array(z.object({ category: z.string(), productId: z.string() }))
        .describe("The composite keys of the products to compare"),
    }),
    execute: async ({ items }) => {
      const products = (
        await Promise.all(items.map(({ category, productId }) => getProductById(category, productId)))
      ).filter(Boolean)
      return { count: products.length, products }
    },
  }),
  listCategories: tool({
    description: "Return the list of product categories available in the catalog.",
    inputSchema: z.object({}),
    execute: async () => {
      const categories = await getCategories()
      return { categories }
    },
  }),
  buildPlanCatalog: tool({
    description:
      "Build the shopper's plan into the main catalog after they confirm. The plan is grouped into sections — each section becomes a category tab on the page that lists its products. Call this EXACTLY ONCE, only after the shopper confirms the plan.",
    inputSchema: z.object({
      title: z.string().describe("The occasion title, e.g. 'Kids Birthday Party'"),
      sections: z
        .array(
          z.object({
            title: z.string().describe("Short section/tab title, e.g. 'Party Music' or 'Gift Ideas'"),
            items: z
              .array(
                z.object({
                  category: z.string().describe("The product's category (partition key)"),
                  productId: z.string().describe("The product's id (sort key)"),
                }),
              )
              .describe("1-4 real catalog products for this section"),
          }),
        )
        .describe("3-5 sections that make up the plan"),
    }),
    execute: async ({ title, sections }) => {
      const resolved = await Promise.all(
        sections.map(async (section) => {
          const products = (
            await Promise.all(section.items.map(({ category, productId }) => getProductById(category, productId)))
          ).filter((p): p is Product => Boolean(p))
          return { title: section.title, products }
        }),
      )
      const filled = resolved.filter((s) => s.products.length > 0)
      const count = filled.reduce((n, s) => n + s.products.length, 0)
      return { title, sections: filled, count }
    },
  }),
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const result = streamText({
    model: "openai/gpt-4o-mini",
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(10),
  })

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error)
      if (/rate.?limit|429|free tier/i.test(message)) {
        return "RATE_LIMIT: The AI model is rate-limited on the free tier. Add AI Gateway credits and retry."
      }
      return "Something went wrong while generating a response. Please try again."
    },
  })
}
