import { getAllProducts, isDatabaseConfigured } from "@/lib/db"
import { Storefront } from "@/components/storefront"
import { SEED_PRODUCTS } from "@/lib/seed-data"
import type { Product } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  // When the DynamoDB integration is wired up (deployed environments), serve the
  // live catalog. Otherwise (local/sandbox preview, where the integration's
  // sensitive credentials aren't injected) fall back to the starter catalog so
  // the storefront and AI assistant stay fully browsable.
  const dbConfigured = isDatabaseConfigured()

  let products: Product[] = SEED_PRODUCTS
  let preview = !dbConfigured

  if (dbConfigured) {
    try {
      const live = await getAllProducts()
      if (live.length > 0) {
        products = live
      } else {
        preview = true // connected but not seeded yet
      }
    } catch {
      preview = true
    }
  }

  return <Storefront products={products} preview={preview} />
}
