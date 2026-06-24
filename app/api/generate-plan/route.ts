import { generateText } from "ai"

// ── In-memory cache ───────────────────────────────────────────────────────────
const memoryCache = new Map<string, any>()

// ── DynamoDB (optional) ───────────────────────────────────────────────────────
let dynamo: any = null

async function getDynamo() {
  if (dynamo) return dynamo
  const hasCredentials =
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.DYNAMODB_TABLE
  if (!hasCredentials) return null
  try {
    const { DynamoDBClient }         = await import("@aws-sdk/client-dynamodb")
    const { DynamoDBDocumentClient } = await import("@aws-sdk/lib-dynamodb")
    dynamo = DynamoDBDocumentClient.from(
      new DynamoDBClient({
        region: process.env.AWS_REGION ?? "us-east-2",
        credentials: {
          accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      }),
    )
    return dynamo
  } catch { return null }
}

function planKey(type: string, description: string) {
  const slug = description.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)
  return `PLAN#${type}#${slug}`
}

// ── Unsplash image fetch ──────────────────────────────────────────────────────
async function fetchUnsplashImage(query: string): Promise<string | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) return null

  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=squarish`
    const res  = await fetch(url, {
      headers: { Authorization: `Client-ID ${accessKey}` },
    })
    const data = await res.json()
    return data.results?.[0]?.urls?.small ?? null
  } catch (err) {
    console.error(`Unsplash fetch failed for "${query}":`, err)
    return null
  }
}

// ── AI: generate full themed plan ─────────────────────────────────────────────
async function generatePlanFromAI(
  description: string,
  type: string,
  guestCount: string,
  budget: string,
) {
  const prompt = `
You are an event planning assistant. Given the event description, generate a themed shopping plan.

Event: "${description}"
Guests: ${guestCount || "unspecified"}
Budget: ${budget || "unspecified"}

Return ONLY a valid JSON object (no markdown, no explanation) in this exact format:
{
  "title": "short event title",
  "sections": [
    {
      "title": "Section Name",
      "products": [
        { "name": "specific themed product name" },
        { "name": "specific themed product name" },
        { "name": "specific themed product name" },
        { "name": "specific themed product name" },
        { "name": "specific themed product name" },
        { "name": "specific themed product name" }
      ]
    }
  ]
}

Rules:
- 3 to 5 sections total
- 6 products per section
- Product names MUST be specific to the theme (e.g. for superhero: "Spider-Man Balloon Arch Kit", "Avengers Birthday Banner")
- Section titles should match the event type (Decorations, Food & Supplies, Party Favors, Games & Activities, etc.)
- DO NOT include brands, prices, ratings, or descriptions
`

  try {
    const { text } = await generateText({
      model: "openai/gpt-4o-mini" as any,
      messages: [{ role: "user", content: prompt }],
    })

    const clean  = text.replace(/```json|```/g, "").trim()
    const parsed = JSON.parse(clean)

    if (parsed.sections && Array.isArray(parsed.sections)) {
      // Fetch Unsplash images in parallel — use section title for better images
      const sectionsWithImages = await Promise.all(
        parsed.sections.map(async (s: any) => {
          const productsWithImages = await Promise.all(
            (s.products ?? []).map(async (p: any) => {
              // Search with product name + section context for better results
              const imageUrl = await fetchUnsplashImage(`${p.name} ${s.title}`)
              return {
                asin:      `B0${String(Math.floor(Math.random() * 9000000) + 1000000)}`,
                name:      p.name,
                amazonUrl: `https://www.amazon.com/s?k=${encodeURIComponent(p.name)}`,
                imageUrl:  imageUrl ?? null,
                inStock:   true,
              }
            }),
          )
          return { title: s.title, products: productsWithImages }
        }),
      )

      return { title: parsed.title ?? description, sections: sectionsWithImages }
    }
  } catch (err) {
    console.error("AI plan generation failed:", err)
  }

  // Fallback
  return {
    title: description,
    sections: [
      {
        title: "Decorations",
        products: await Promise.all(
          ["Balloon Arch Kit", "Birthday Banner", "Table Centerpiece", "String Lights", "Confetti Cannon", "Hanging Decorations"]
            .map(async (name) => ({
              asin:      `B0${String(Math.floor(Math.random() * 9000000) + 1000000)}`,
              name,
              amazonUrl: `https://www.amazon.com/s?k=${encodeURIComponent(name)}`,
              imageUrl:  await fetchUnsplashImage(name),
              inStock:   true,
            })),
        ),
      },
    ],
  }
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { description, type, guestCount, budget } = await req.json()

    if (!description?.trim()) {
      return Response.json({ error: "Description is required" }, { status: 400 })
    }

    const cacheKey = planKey(type ?? "event-party", description)

    // 1. Memory cache
    if (memoryCache.has(cacheKey)) {
      return Response.json({ plan: memoryCache.get(cacheKey), source: "cache" })
    }

    // 2. DynamoDB cache
    const db = await getDynamo()
    if (db) {
      try {
        const { GetCommand } = await import("@aws-sdk/lib-dynamodb")
        const existing = await db.send(
          new GetCommand({ TableName: process.env.DYNAMODB_TABLE, Key: { category: "PLAN", productId: cacheKey } }),
        )
        if (existing.Item?.plan) {
          memoryCache.set(cacheKey, existing.Item.plan)
          return Response.json({ plan: existing.Item.plan, source: "cache" })
        }
      } catch (err) {
        console.error("DynamoDB read error:", err)
      }
    }

    // 3. Generate via AI + Unsplash images
    const plan = await generatePlanFromAI(description, type ?? "event-party", guestCount ?? "", budget ?? "")

    // 4. Cache in memory
    memoryCache.set(cacheKey, plan)

    // 5. Save to DynamoDB (non-blocking)
    if (db) {
      try {
        const { PutCommand } = await import("@aws-sdk/lib-dynamodb")
        await db.send(
          new PutCommand({
            TableName: process.env.DYNAMODB_TABLE,
            Item: {
              category: "PLAN", productId: cacheKey, plan, description, type,
              createdAt: new Date().toISOString(),
              ttl: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
            },
          }),
        )
      } catch (err) {
        console.error("DynamoDB write error:", err)
      }
    }

    return Response.json({ plan, source: "ai" })
  } catch (err) {
    console.error("generate-plan error:", err)
    return Response.json(
      { error: "Failed to generate plan", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
