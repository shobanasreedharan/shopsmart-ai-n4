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
- Available categories include Headphones, Laptops, Wearables, Monitors, and Home.`

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
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const result = streamText({
    model: "openai/gpt-5-mini",
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(6),
  })

  return result.toUIMessageStreamResponse()
}
