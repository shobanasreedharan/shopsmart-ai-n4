export interface Product {
  category: string
  productId: string
  name: string
  brand: string
  description: string
  price: number
  originalPrice?: number
  rating: number
  reviewCount: number
  features: string[]
  tags: string[]
  imageUrl?: string
  inStock: boolean
}
