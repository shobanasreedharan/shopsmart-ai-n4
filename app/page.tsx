import { getAllProducts, isDatabaseConfigured } from "@/lib/db"
import { Storefront } from "@/components/storefront"
import { SEED_PRODUCTS } from "@/lib/seed-data"
import type { Product } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const dbConfigured = isDatabaseConfigured()

  let products: Product[] = SEED_PRODUCTS
  let preview = !dbConfigured

  if (dbConfigured) {
    try {
      const live = await getAllProducts()
      if (live.length > 0) {
        products = live
      } else {
        preview = true
      }
    } catch {
      preview = true
    }
  }

  return <Storefront products={products} preview={preview} />
}
