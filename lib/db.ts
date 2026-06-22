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

export const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME
// Composite key: partition key "category" (String), sort key "productId" (String)
const PARTITION_KEY = "category"
const SORT_KEY = "productId"

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
  const result = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }))
  return (result.Items || []) as Product[]
}

/** Fetch all products within a single category (efficient partition query). */
export async function getProductsByCategory(category: string): Promise<Product[]> {
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
  let count = 0
  for (const product of products) {
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: product }))
    count++
  }
  return count
}
