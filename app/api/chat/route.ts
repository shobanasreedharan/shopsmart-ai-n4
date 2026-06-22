import { streamText, convertToModelMessages, tool, stepCountIs, type UIMessage } from "ai"
import { z } from "zod"
import { searchProducts, getProductsByCategory, getCategories, getProductById } from "@/lib/db"

export const maxDuration = 30

const SYSTEM_PROMPT = `You are ShopSmart AI, a friendly and knowledgeable shopping assistant.

Your job is to help shoppers find the right products, compare options, and spot good deals from the store catalog.

Guidelines:
- ALWAYS use your tools to look up real products before recommending anything. Never invent products, prices, or specs.
- When a shopper describes a need or budget, call searchProducts with appropriate filters.
- When comparing items, fetch them and explain trade-offs clearly (price, features, ratings).
- Point out deals when a product has an originalPrice higher than its current price.
- Keep replies concise and conversational. Use short paragraphs or compact bullet points.
- After recommending, the product cards are shown to the user automatically from your tool results, so do NOT repeat full specs in prose — summarize why each pick fits.
- If nothing matches, say so honestly and suggest adjusting the budget or criteria.
- Available categories include Headphones, Laptops, Wearables, Monitors, and Home.

Planning for an occasion or project (e.g. "plan for a birthday party", "set up a home office", "gifts for a runner"):
1. FIRST ask 2-4 short clarifying questions in a single message (e.g. budget, number of people/recipients, must-haves, preferences). Present them as a compact bulleted list and wait for the shopper's answer. Do NOT search yet. Ask questions only ONCE.
2. Once they answer, immediately search the catalog with AT MOST 2 searchProducts calls. The catalog is limited to these categories: Headphones, Laptops, Wearables, Monitors, Home. If the shopper mentions something we don't carry (e.g. "speakers", "TV", "decorations"), substitute the closest item we DO carry (e.g. headphones/earbuds instead of speakers, a fitness band or smart coffee maker as a fun gadget gift). Keep searches broad — avoid over-filtering.
3. You MUST then call createShoppingPlan exactly once with a short title and 3-6 chosen items (each with a one-line reason), picking the best available products within budget. NEVER end your turn by asking more questions or saying nothing matched — always deliver a concrete plan built from real catalog items.
4. After calling createShoppingPlan, write a brief friendly summary of the list and the total. Do not list the items again in detail — the cards are shown automatically.`

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
  createShoppingPlan: tool({
    description:
      "Finalize a curated shopping list/plan after you have gathered the shopper's requirements. Call this once you know what to recommend for their occasion or project. The selected products are shown to the shopper and the main store catalog refreshes to display exactly this list.",
    inputSchema: z.object({
      title: z.string().describe("Short title for the plan, e.g. 'Birthday Party Tech Kit'"),
      items: z
        .array(
          z.object({
            category: z.string().describe("The product's category (partition key)"),
            productId: z.string().describe("The product's id (sort key)"),
            reason: z.string().describe("One short line on why this item is recommended"),
          }),
        )
        .describe("The chosen products that make up the plan"),
    }),
    execute: async ({ title, items }) => {
      const resolved = await Promise.all(
        items.map(async ({ category, productId, reason }) => {
          const product = await getProductById(category, productId)
          return product ? { product, reason } : null
        }),
      )
      const picks = resolved.filter((x): x is { product: NonNullable<typeof x>["product"]; reason: string } => Boolean(x))
      const products = picks.map((p) => p.product)
      const total = products.reduce((sum, p) => sum + p.price, 0)
      return {
        title,
        count: products.length,
        total: Math.round(total * 100) / 100,
        products,
        items: picks.map((p) => ({ productId: p.product.productId, reason: p.reason })),
      }
    },
  }),
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const result = streamText({
    model: "openai/gpt-5-mini",
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
