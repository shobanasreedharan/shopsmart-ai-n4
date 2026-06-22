import { Sparkles, Database } from "lucide-react"
import { getAllProducts } from "@/lib/db"
import { Storefront } from "@/components/storefront"
import type { Product } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  let products: Product[] = []
  let error: string | null = null

  try {
    products = await getAllProducts()
  } catch (e) {
    error = e instanceof Error ? e.message : "Unable to reach the product database."
  }

  if (error) {
    return <SetupNotice variant="error" message={error} />
  }

  if (products.length === 0) {
    return <SetupNotice variant="empty" />
  }

  return <Storefront products={products} />
}

function SetupNotice({ variant, message }: { variant: "error" | "empty"; message?: string }) {
  const isError = variant === "error"
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Sparkles className="size-6" aria-hidden="true" />
      </span>
      <div className="max-w-md space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">ShopSmart AI</h1>
        {isError ? (
          <p className="leading-relaxed text-muted-foreground">
            Couldn&apos;t load the catalog from DynamoDB. Make sure the database is connected and the{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-sm">AWS_REGION</code>,{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-sm">AWS_ROLE_ARN</code>, and{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-sm">DYNAMODB_TABLE_NAME</code> environment
            variables are set.
          </p>
        ) : (
          <p className="leading-relaxed text-muted-foreground">
            Your catalog is empty. Seed the starter products to get started.
          </p>
        )}
        {message && (
          <p className="rounded-md bg-muted px-3 py-2 text-left font-mono text-xs text-muted-foreground">
            {message}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <Database className="size-4 text-primary" aria-hidden="true" />
        {isError ? (
          <span>Connect DynamoDB, then refresh this page.</span>
        ) : (
          <span>
            Send a POST request to <code className="rounded bg-muted px-1 py-0.5">/api/seed</code> to load
            the catalog, then refresh.
          </span>
        )}
      </div>
    </main>
  )
}
