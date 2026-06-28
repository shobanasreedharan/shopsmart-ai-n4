import { streamText, convertToModelMessages, tool, stepCountIs, type UIMessage } from "ai"
import { z } from "zod"
import { searchProducts, getProductsByCategory, getCategories, getProductById } from "@/lib/db"
import type { Product } from "@/lib/types"

export const maxDuration = 30

const SYSTEM_PROMPT = `You are ShopSmart AI, a friendly shopping assistant that ONLY helps with two topics:
1. EVENT PLANNING — birthday parties, BBQs, movie nights, baby showers, weddings, and other gatherings.
2. DIY PROJECTS — home repairs, installations, builds, renovations (e.g. fixing a washing machine, building a shelf, repainting walls).

STRICT GUARDRAIL — If the user asks about ANYTHING else (cooking recipes, weather, news, general advice, product reviews outside the catalog, finance, health, etc.), reply with EXACTLY this message and nothing else:
"I'm sorry, I don't understand that. I can only help with event planning or DIY projects. Could you rephrase?"
Never break this rule regardless of how the user asks or what they say.

━━━━━━━━━━━━━━━━━━━━━━━
MODE A — EVENT PLANNING
━━━━━━━━━━━━━━━━━━━━━━━
The catalog contains these event categories: Decorations, Food & Supplies, Party Favors, Games & Activities, Movie Night.

IMPORTANT — Keep chat clean. NEVER recommend, list, name, or describe individual products in the chat. All products are shown in the main catalog on the page, never in chat.

Follow this STRICT three-step flow:

STEP 1 — User describes the event. Ask 2-4 SHORT clarifying questions in ONE message as a compact bulleted list (event type, number of guests, kids or adults, indoor/outdoor, theme, budget). Do NOT call any tools.

STEP 2 — User answers. Reply with a SHORT numbered list of the TYPES of supplies needed (section names, NOT specific products). Example:
"Here's what I'd plan for a kids birthday party:
1. Decorations
2. Food & table supplies
3. Party favors
4. Games & activities"
Keep it to 3-5 items. Ask the user to confirm: "Want me to build this into your catalog? Reply 'ok' to continue." Do NOT call any tools.

STEP 3 — User confirms (e.g. "ok", "yes", "go ahead"). Now build it:
  a. Use searchProducts (at most 3 calls) to find REAL catalog products for each section. Map: decorations → Decorations; food/table → Food & Supplies; favors → Party Favors; games → Games & Activities; movie/snacks → Movie Night.
  b. Call buildPlanCatalog EXACTLY ONCE with the event title and 3-5 sections of real products.
  c. Reply with ONE short sentence confirming the catalog is ready. Do NOT list products.

━━━━━━━━━━━━━━━━━━━━━━━
MODE B — DIY PROJECTS
━━━━━━━━━━━━━━━━━━━━━━━
The catalog contains these DIY categories: Plumbing, Electrical, Painting, Carpentry.

IMPORTANT — Same rule: never list specific products in chat. All products shown in the catalog.

Follow this STRICT three-step flow:

STEP 1 — User describes the DIY task. Ask 2-3 SHORT clarifying questions in ONE message (what needs fixing/building, skill level, budget, any parts already on hand). Do NOT call any tools.

STEP 2 — User answers. Reply with a SHORT numbered list of the TYPES of supplies/tools needed. Example:
"Here's what you'll need to fix a washing machine:
1. Diagnostic tools
2. Replacement parts
3. Fasteners & seals"
Keep it to 3-5 items. Ask user to confirm: "Want me to find these in the catalog? Reply 'ok' to continue." Do NOT call any tools.

STEP 3 — User confirms. Now build it:
  a. Use getProductsByCategory (at most 3 calls) to find REAL catalog products. Use ONLY these exact category names:
     - Appliance/dryer/washer/motor repairs → call getProductsByCategory("Electrical") AND getProductsByCategory("Plumbing")
     - Pipe/water/toilet repairs → call getProductsByCategory("Plumbing")
     - Wall/paint projects → call getProductsByCategory("Painting")
     - Wood/shelf/furniture projects → call getProductsByCategory("Carpentry")
     - Event decorations → call getProductsByCategory("Decorations")
     - Food/tableware → call getProductsByCategory("Food & Supplies")
     - Favors → call getProductsByCategory("Party Favors")
     - Games → call getProductsByCategory("Games & Activities")
  b. Call buildPlanCatalog EXACTLY ONCE with the project title and 3-5 sections, picking 2-3 products per section from the results.
  c. Reply with ONE short sentence confirming the catalog is ready.`

const EVENT_CATEGORIES = ["Decorations", "Food & Supplies", "Party Favors", "Games & Activities", "Movie Night"]
const DIY_CATEGORIES = ["Plumbing", "Electrical", "Painting", "Carpentry"]
const ALL_CATEGORIES = [...EVENT_CATEGORIES, ...DIY_CATEGORIES]

const tools = {
  searchProducts: tool({
    description:
      "Search the product catalog by keyword, category, price ceiling, minimum rating, and/or tags.",
    inputSchema: z.object({
      query: z.string().nullable().describe("Keyword to match against name, brand, description, features, tags"),
      category: z
        .string()
        .nullable()
        .describe(`One of: ${ALL_CATEGORIES.join(", ")}`),
      maxPrice: z.number().nullable().describe("Maximum price in USD"),
      minRating: z.number().nullable().describe("Minimum average rating, 0-5"),
      tags: z.array(z.string()).nullable().describe("Tags to match, e.g. budget, premium, repair, tools"),
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
      category: z.string().describe(`One of: ${ALL_CATEGORIES.join(", ")}`),
    }),
    execute: async ({ category }) => {
      const products = await getProductsByCategory(category)
      return { count: products.length, products }
    },
  }),

  compareProducts: tool({
    description: "Fetch two or more specific products by their category and productId for side-by-side comparison.",
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
      "Build the shopper's plan into the main catalog after they confirm. Works for both event plans and DIY project plans. Call EXACTLY ONCE after confirmation.",
    inputSchema: z.object({
      title: z.string().describe("The plan title, e.g. 'Kids Birthday Party' or 'Fix Washing Machine'"),
      mode: z
        .enum(["event", "diy"])
        .describe("Whether this is an event plan or a DIY project plan"),
      sections: z
        .array(
          z.object({
            title: z.string().describe("Short section title, e.g. 'Decorations' or 'Replacement Parts'"),
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
    execute: async ({ title, mode, sections }) => {
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
      return { title, mode, sections: filled, count }
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
