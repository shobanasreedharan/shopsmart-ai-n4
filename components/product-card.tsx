import Image from "next/image"
import { Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Product } from "@/lib/types"

function formatPrice(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 })
}

export function ProductCard({ product }: { product: Product }) {
  const onSale = product.originalPrice != null && product.originalPrice > product.price
  const discount = onSale
    ? Math.round(((product.originalPrice! - product.price) / product.originalPrice!) * 100)
    : 0

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50">
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl || "/placeholder.svg"}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 240px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No image
          </div>
        )}
        {onSale && (
          <Badge className="absolute left-2 top-2 bg-primary text-primary-foreground">
            {discount}% off
          </Badge>
        )}
        {!product.inStock && (
          <Badge variant="secondary" className="absolute right-2 top-2">
            Out of stock
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {product.brand}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3.5 fill-chart-3 text-chart-3" aria-hidden="true" />
            <span className="font-medium text-foreground">{product.rating.toFixed(1)}</span>
            <span className="sr-only">average rating</span>
            <span>({product.reviewCount.toLocaleString()})</span>
          </span>
        </div>

        <h3 className="text-pretty text-sm font-semibold leading-snug text-card-foreground">
          {product.name}
        </h3>

        <ul className="flex flex-wrap gap-1.5">
          {product.features.slice(0, 3).map((feature) => (
            <li key={feature}>
              <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground">
                {feature}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-auto flex items-baseline gap-2 pt-1">
          <span className="text-lg font-bold text-card-foreground">{formatPrice(product.price)}</span>
          {onSale && (
            <span className="text-sm text-muted-foreground line-through">
              {formatPrice(product.originalPrice!)}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

export function ProductGrid({ products, className }: { products: Product[]; className?: string }) {
  if (!products.length) return null
  return (
    <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-3", className)}>
      {products.map((product) => (
        <ProductCard key={`${product.category}-${product.productId}`} product={product} />
      ))}
    </div>
  )
}
