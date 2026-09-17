import { createContext, useContext, type ReactNode } from 'react'

interface ProductTourContextValue {
  replayProductTour: () => Promise<void>
}

const ProductTourContext = createContext<ProductTourContextValue | null>(null)

export function ProductTourProvider({
  children,
  replayProductTour,
}: {
  children: ReactNode
  replayProductTour: () => Promise<void>
}) {
  return (
    <ProductTourContext.Provider value={{ replayProductTour }}>{children}</ProductTourContext.Provider>
  )
}

export function useProductTour(): ProductTourContextValue | null {
  return useContext(ProductTourContext)
}
