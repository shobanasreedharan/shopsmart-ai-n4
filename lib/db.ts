import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb"
import { awsCredentialsProvider } from "@vercel/functions/oidc"
import type { Product } from "./types"
import { SEED_PRODUCTS } from "./seed-data"

export const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME
// Key names come from the integration-provided env vars so they always match the
// actual table schema. Fall back to the catalog's natural composite key.
const PARTITION_KEY = process.env.DYNAMODB_TABLE_PARTITION_KEY || "category"
const SORT_KEY = process.env.DYNAMODB_TABLE_SORT_KEY || "productId"

/**
 * Whether the DynamoDB integration is wired up in this environment. The
 * integration's credentials are sensitive and only present in deployed
 * (preview/production) environments — never in the local/sandbox dev runtime —
 * so when they're absent we transparently serve the starter catalog instead.
 */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.AWS_REGION && process.env.AWS_ROLE_ARN && process.env.DYNAMODB_TABLE_NAME)
}

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: awsCredentialsProvider({
    roleArn: process.env.AWS_ROLE_ARN as string,
    clientConfig: { region: process.env.AWS_REGION },
  }),
})

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
})

/** Fetch every product in the catalog. */
export async function getAllProducts(): Promise<Product[]> {
  if (!isDatabaseConfigured()) return SEED_PRODUCTS
  const result = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }))
  return (result.Items || []) as Product[]
}

/** Fetch all products within a single category (efficient partition query). */
export async function getProductsByCategory(category: string): Promise<Product[]> {
  if (!isDatabaseConfigured()) return SEED_PRODUCTS.filter((p) => p.category === category)
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "#pk = :category",
      ExpressionAttributeNames: { "#pk": PARTITION_KEY },
      ExpressionAttributeValues: { ":category": category },
    }),
  )
  return (result.Items || []) as Product[]
}

/** Fetch a single product by its category + productId composite key. */
export async function getProductById(category: string, productId: string): Promise<Product | null> {
  if (!isDatabaseConfigured())
    return SEED_PRODUCTS.find((p) => p.category === category && p.productId === productId) ?? null
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { [PARTITION_KEY]: category, [SORT_KEY]: productId },
    }),
  )
  return (result.Item as Product) || null
}

interface SearchFilters {
  query?: string
  category?: string
  maxPrice?: number
  minRating?: number
  tags?: string[]
}

/**
 * Search the catalog. Uses a category Query when a category is provided,
 * otherwise scans the full table, then filters in-memory on the remaining
 * criteria (keyword, price, rating, tags).
 */
export async function searchProducts(filters: SearchFilters): Promise<Product[]> {
  const base = filters.category
    ? await getProductsByCategory(filters.category)
    : await getAllProducts()

  const q = filters.query?.toLowerCase().trim()

  return base
    .filter((p) => {
      if (q) {
        const haystack = [
          p.name,
          p.brand,
          p.description,
          ...(p.features || []),
          ...(p.tags || []),
        ]
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (filters.maxPrice != null && p.price > filters.maxPrice) return false
      if (filters.minRating != null && p.rating < filters.minRating) return false
      if (filters.tags?.length) {
        const productTags = (p.tags || []).map((t) => t.toLowerCase())
        const wanted = filters.tags.map((t) => t.toLowerCase())
        if (!wanted.some((t) => productTags.includes(t))) return false
      }
      return true
    })
    .sort((a, b) => b.rating - a.rating)
}

/** Distinct list of categories present in the catalog. */
export async function getCategories(): Promise<string[]> {
  const all = await getAllProducts()
  return Array.from(new Set(all.map((p) => p.category))).sort()
}

/** Seed the table with the starter catalog. Idempotent via Put. */
export async function seedProducts(products: Product[]): Promise<number> {
  if (!isDatabaseConfigured()) {
    throw new Error("DynamoDB is not configured in this environment. Deploy or connect the database to seed.")
  }
  let count = 0
  for (const product of products) {
    // Ensure the table's key attributes are populated regardless of their
    // configured names (partition key holds the category, sort key the productId).
    const item: Record<string, unknown> = {
      ...product,
      [PARTITION_KEY]: product.category,
      [SORT_KEY]: product.productId,
    }
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }))
    count++
  }
  return count
}
