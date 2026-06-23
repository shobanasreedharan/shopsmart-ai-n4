import { generateText } from "ai"

// ── In-memory cache (survives warm Lambda invocations) ────────────────────────
const memoryCache = new Map<string, any>()

// ── DynamoDB (optional — only used if AWS credentials are present) ────────────
let dynamo: any = null

async function getDynamo() {
  if (dynamo) return dynamo
  const hasCredentials =
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.DYNAMODB_TABLE

  if (!hasCredentials) return null

  try {
    const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb")
    const { DynamoDBDocumentClient } = await import("@aws-sdk/lib-dynamodb")
    dynamo = DynamoDBDocumentClient.from(
      new DynamoDBClient({
        region: process.env.AWS_REGION ?? "us-east-2",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      }),
    )
    return dynamo
  } catch {
    return null
  }
}

function planKey(type: string, description: string) {
  const slug = description.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)
  return `PLAN#${type}#${slug}`
}

// ── Mock Amazon products ──────────────────────────────────────────────────────
function mockAmazonProducts(sectionTitle: string, count = 6) {
  const catalog: Record<string, { brands: string[]; names: string[] }> = {
    "Decorations":        { brands: ["FestaCo","GlowNest","PartyPop","DecoLux"],        names: ["Balloon Arch Kit","Foil Banner Set","LED String Lights","Paper Lanterns","Confetti Cannon","Centerpiece Kit"] },
    "Food & Supplies":    { brands: ["ServeWell","TableTop","FreshFete","EasyEats"],     names: ["Party Plates Set (24)","Disposable Cups 50pk","Cutlery Set 96pc","Paper Napkins 200ct","Table Cover 4-Pack","Serving Trays Set"] },
    "Party Favors":       { brands: ["JoyBox","FavorBox","GiftGlow","TreatCo"],         names: ["Goodie Bags 24pk","Bubble Wand Pack","Mini Toy Assortment","Sticker Sheet Bulk","Candy Favor Boxes","Thank-You Tags"] },
    "Games & Activities": { brands: ["FiestaPlay","FunZone","GameTime","PlayPro"],      names: ["Pull-String Piñata","Ring Toss Game","Face Paint Kit","Bean Bag Toss","Musical Chairs Set","Scavenger Hunt Kit"] },
    "Movie Night":        { brands: ["CozyReel","ScreenNest","NightIn","CinemaBox"],    names: ["Tabletop Popcorn Maker","Projector Screen 100\"","Plush Throw Blankets","Snack Variety Box","LED Floor Cushions","Mini Projector"] },
    "Plumbing":           { brands: ["FixIt","PipePro","FlowRight","DrainMate"],        names: ["Drain Snake 25ft","Pipe Repair Tape 3pk","Toilet Repair Kit","Plumber's Putty Set","Compression Fittings","Pipe Cutter Tool"] },
    "Electrical":         { brands: ["SafeElec","WireWise","VoltPro","CircuitCo"],      names: ["Digital Multimeter","Outlet Tester","Wire Stripper Kit","Electrical Tape 10pk","Junction Box Set","Cable Staples 100pk"] },
    "Painting":           { brands: ["WallCo","BrushPro","ColorRight","PaintMate"],     names: ["Paint Roller Kit 9pc","Painter's Tape 3pk","Wall Patch Kit","Canvas Drop Cloth","Angled Trim Brush","Paint Tray Liners 10pk"] },
    "Carpentry":          { brands: ["BuildRight","WoodPro","NailIt","CraftBuild"],     names: ["Drill Bit Set 50pc","Framing Hammer 20oz","Wood Glue & Clamp Kit","Sandpaper Set 40pc","Speed Square","Pocket Screw Kit"] },
    "Appliances":         { brands: ["AppliancePro","FixApply","HomeRepair","TechFix"], names: ["Washing Machine Repair Kit","Dryer Vent Brush Kit","Fridge Door Gasket","Dishwasher Tablets 6pk","Appliance Touch-Up Paint","Motor Capacitor Kit"] },
  }

  const entry     = catalog[sectionTitle] ?? { brands: ["BrandCo","ProMake"], names: ["Essential Kit","Pro Set","Starter Pack","Deluxe Bundle","Value Pack","Complete Set"] }
  const brandList = entry.brands
  const nameList  = entry.names

  return Array.from({ length: count }, (_, i) => ({
    asin:          `B0${String(Math.floor(Math.random() * 9000000) + 1000000)}`,
    name:          nameList[i % nameList.length],
    brand:         brandList[i % brandList.length],
    price:         parseFloat((Math.random() * 45 + 5).toFixed(2)),
    originalPrice: Math.random() > 0.4 ? parseFloat((Math.random() * 20 + 20).toFixed(2)) : null,
    rating:        parseFloat((Math.random() * 1.5 + 3.5).toFixed(1)),
    reviewCount:   Math.floor(Math.random() * 8000 + 200),
    imageUrl:      `/products/${sectionTitle.toLowerCase().replace(/[^a-z]/g, "-")}-${i + 1}.png`,
    amazonUrl:     `https://www.amazon.com/s?k=${encodeURIComponent(nameList[i % nameList.length])}`,
    inStock:       Math.random() > 0.1,
    badge:         Math.random() > 0.6 ? "Best Seller" : Math.random() > 0.5 ? "Amazon's Choice" : null,
  }))
}

// ── AI section generation ─────────────────────────────────────────────────────
async function generateSections(description: string, type: string, guestCount: string, budget: string): Promise<string[]> {
  const isDiy = type === "diy"

  try {
    const { text } = await generateText({
      model: "openai/gpt-4o-mini" as any,
      system: isDiy
        ? `Return ONLY a JSON array of 3-5 short DIY section names for tools/supplies needed. No explanation. Example: ["Diagnostic Tools","Replacement Parts","Fasteners & Seals"]`
        : `Return ONLY a JSON array of 3-5 short event section names for supplies needed. No explanation. Example: ["Decorations","Food & Supplies","Party Favors","Games & Activities"]`,
      messages: [{ role: "user", content: `Task: ${description}. Guests: ${guestCount || "unspecified"}. Budget: ${budget || "unspecified"}.` }],
    })
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim())
    if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) return parsed.slice(0, 5)
  } catch (err) {
    console.error("AI generation failed, using fallback:", err)
  }

  return isDiy
    ? ["Tools & Equipment", "Replacement Parts", "Safety Supplies"]
    : ["Decorations", "Food & Supplies", "Party Favors", "Games & Activities"]
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { description, type, guestCount, budget } = await req.json()

    if (!description?.trim()) {
      return Response.json({ error: "Description is required" }, { status: 400 })
    }

    const cacheKey = planKey(type ?? "event-party", description)

    // 1. Check memory cache
    if (memoryCache.has(cacheKey)) {
      console.log("Memory cache hit:", cacheKey)
      return Response.json({ plan: memoryCache.get(cacheKey), source: "cache" })
    }

    // 2. Check DynamoDB (if credentials available)
    const db = await getDynamo()
    if (db) {
      try {
        const { GetCommand } = await import("@aws-sdk/lib-dynamodb")
        const existing = await db.send(
          new GetCommand({ TableName: process.env.DYNAMODB_TABLE, Key: { category: "PLAN", productId: cacheKey } }),
        )
        if (existing.Item?.plan) {
          console.log("DynamoDB cache hit:", cacheKey)
          memoryCache.set(cacheKey, existing.Item.plan)
          return Response.json({ plan: existing.Item.plan, source: "cache" })
        }
      } catch (err) {
        console.error("DynamoDB read error:", err)
      }
    }

    // 3. Generate via AI
    const sections = await generateSections(description, type ?? "event-party", guestCount ?? "", budget ?? "")

    const plan = {
      title: description,
      type:  type ?? "event-party",
      sections: sections.map((title) => ({ title, products: mockAmazonProducts(title) })),
    }

    // 4. Cache in memory
    memoryCache.set(cacheKey, plan)

    // 5. Save to DynamoDB (non-blocking, if available)
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
        console.error("DynamoDB write error (non-fatal):", err)
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
