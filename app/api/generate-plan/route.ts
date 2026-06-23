import { generateText, tool } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb"

const TABLE = process.env.DYNAMODB_TABLE ?? "shopsmart-db"

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION ?? "us-east-2",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  }),
)

// ── Stable cache key from description + type ──────────────────────────────────
function planKey(type: string, description: string) {
  const slug = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
  return `PLAN#${type}#${slug}`
}

// ── Amazon mock data generator ────────────────────────────────────────────────
function mockAmazonProducts(sectionTitle: string, count = 6) {
  const brands: Record<string, string[]> = {
    Decorations:       ["FestaCo", "GlowNest", "PartyPop", "DecoLux"],
    "Food & Supplies": ["ServeWell", "TableTop", "FreshFete", "EasyEats"],
    "Party Favors":    ["JoyBox", "FavorBox", "GiftGlow", "TreatCo"],
    "Games & Activities": ["FiestaPlay", "FunZone", "GameTime", "PlayPro"],
    "Movie Night":     ["CozyReel", "ScreenNest", "NightIn", "CinemaBox"],
    Plumbing:          ["FixIt", "PipePro", "FlowRight", "DrainMate"],
    Electrical:        ["SafeElec", "WireWise", "VoltPro", "CircuitCo"],
    Painting:          ["WallCo", "BrushPro", "ColorRight", "PaintMate"],
    Carpentry:         ["BuildRight", "WoodPro", "NailIt", "CraftBuild"],
    Appliances:        ["AppliancePro", "FixApply", "HomeRepair", "TechFix"],
  }

  const templates: Record<string, string[]> = {
    Decorations:       ["Balloon Arch Kit", "Foil Banner Set", "LED String Lights", "Paper Lanterns", "Confetti Cannon", "Table Centerpiece Kit"],
    "Food & Supplies": ["Party Plates Set (24)", "Disposable Cups 50pk", "Cutlery Set 96pc", "Paper Napkins 200ct", "Table Cover 4-Pack", "Serving Trays Set"],
    "Party Favors":    ["Goodie Bags 24pk", "Bubble Wand Pack", "Mini Toy Assortment", "Sticker Sheet Bulk", "Candy Favor Boxes", "Thank-You Tags"],
    "Games & Activities": ["Pull-String Piñata", "Ring Toss Game", "Face Paint Kit", "Bean Bag Toss", "Musical Chairs Set", "Scavenger Hunt Kit"],
    "Movie Night":     ["Tabletop Popcorn Maker", "Projector Screen 100\"", "Plush Throw Blankets", "Snack Variety Box", "LED Floor Cushions", "Mini Projector"],
    Plumbing:          ["Drain Snake 25ft", "Pipe Repair Tape 3pk", "Toilet Repair Kit", "Plumber's Putty Set", "Compression Fittings", "Pipe Cutter Tool"],
    Electrical:        ["Digital Multimeter", "Outlet Tester 3-Fn", "Wire Stripper Kit", "Electrical Tape 10pk", "Junction Box Set", "Cable Staples 100pk"],
    Painting:          ["Paint Roller Kit 9pc", "Painter's Tape 3pk", "Wall Patch Kit", "Canvas Drop Cloth", "Angled Trim Brush", "Paint Tray Liners 10pk"],
    Carpentry:         ["Drill Bit Set 50pc", "Framing Hammer 20oz", "Wood Glue & Clamp Kit", "Sandpaper Set 40pc", "Speed Square", "Pocket Screw Kit"],
    Appliances:        ["Washing Machine Repair Kit", "Dryer Vent Brush Kit", "Fridge Door Gasket", "Dishwasher Tablets 6pk", "Appliance Touch-Up Paint", "Motor Capacitor Kit"],
  }

  const brandList = brands[sectionTitle] ?? ["BrandCo", "ProMake", "HomePlus", "QualityPick"]
  const nameList  = templates[sectionTitle] ?? ["Essential Kit", "Pro Set", "Starter Pack", "Deluxe Bundle", "Value Pack", "Complete Set"]

  return Array.from({ length: count }, (_, i) => ({
    asin:        `B0${String(Math.floor(Math.random() * 9000000) + 1000000)}`,
    name:        nameList[i % nameList.length],
    brand:       brandList[i % brandList.length],
    price:       parseFloat((Math.random() * 45 + 5).toFixed(2)),
    originalPrice: Math.random() > 0.4
      ? parseFloat((Math.random() * 20 + 20).toFixed(2))
      : null,
    rating:      parseFloat((Math.random() * 1.5 + 3.5).toFixed(1)),
    reviewCount: Math.floor(Math.random() * 8000 + 200),
    imageUrl:    `/products/${sectionTitle.toLowerCase().replace(/[^a-z]/g, "-")}-${i + 1}.png`,
    amazonUrl:   `https://www.amazon.com/dp/B0${String(Math.floor(Math.random() * 9000000) + 1000000)}`,
    inStock:     Math.random() > 0.1,
    badge:       Math.random() > 0.6 ? "Best Seller" : Math.random() > 0.5 ? "Amazon's Choice" : null,
  }))
}

// ── AI: generate section titles for the plan ─────────────────────────────────
async function generateSectionsFromAI(
  description: string,
  type: string,
  guestCount: string,
  budget: string,
): Promise<string[]> {
  const isDiy = type === "diy"

  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    system: isDiy
      ? `You are a DIY project planning assistant. Given a DIY task, return ONLY a JSON array of 3-5 short section/category names (strings) covering the tools and supplies needed. Example: ["Diagnostic Tools","Replacement Parts","Fasteners & Seals"]. No explanation, no markdown.`
      : `You are an event planning assistant. Given an event description, return ONLY a JSON array of 3-5 short section/category names (strings) covering supplies needed. Example: ["Decorations","Food & Supplies","Party Favors","Games & Activities"]. No explanation, no markdown.`,
    messages: [
      {
        role: "user",
        content: `Task: ${description}\nType: ${type}\nGuests: ${guestCount || "unspecified"}\nBudget: ${budget || "unspecified"}`,
      },
    ],
  })

  try {
    const clean = text.replace(/```json|```/g, "").trim()
    const parsed = JSON.parse(clean)
    if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) {
      return parsed.slice(0, 5)
    }
  } catch {
    // fallback
  }

  return isDiy
    ? ["Tools & Equipment", "Replacement Parts", "Safety Supplies"]
    : ["Decorations", "Food & Supplies", "Party Favors"]
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { description, type, guestCount, budget } = await req.json()

    if (!description?.trim()) {
      return Response.json({ error: "Description is required" }, { status: 400 })
    }

    const cacheKey = planKey(type ?? "event-party", description)

    // ── 1. Check DynamoDB cache ───────────────────────────────────────────────
    const existing = await dynamo.send(
      new GetCommand({ TableName: TABLE, Key: { category: "PLAN", productId: cacheKey } }),
    )

    if (existing.Item?.plan) {
      return Response.json({ plan: existing.Item.plan, source: "cache" })
    }

    // ── 2. Generate sections via AI ───────────────────────────────────────────
    const sections = await generateSectionsFromAI(description, type, guestCount, budget)

    // ── 3. Build plan with mock Amazon products ───────────────────────────────
    const plan = {
      title: description,
      type,
      sections: sections.map((title) => ({
        title,
        products: mockAmazonProducts(title),
      })),
    }

    // ── 4. Save to DynamoDB ───────────────────────────────────────────────────
    await dynamo.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          category:  "PLAN",
          productId: cacheKey,
          plan,
          description,
          type,
          createdAt: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7-day TTL
        },
      }),
    )

    return Response.json({ plan, source: "ai" })
  } catch (err) {
    console.error("generate-plan error", err)
    return Response.json({ error: "Failed to generate plan" }, { status: 500 })
  }
}
