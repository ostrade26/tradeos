import { createContext, useContext, type ReactNode } from 'react'

interface ProductTourContextValue {
  replayProductTour: () => Promise<void>
  replayAccountSetup: () => Promise<void>
}

const ProductTourContext = createContext<ProductTourContextValue | null>(null)

export function ProductTourProvider({
  children,
  replayProductTour,
  replayAccountSetup,
}: {
  children: ReactNode
  replayProductTour: () => Promise<void>
  replayAccountSetup: () => Promise<void>
}) {
  return (
    <ProductTourContext.Provider value={{ replayProductTour, replayAccountSetup }}>
      {children}
    </ProductTourContext.Provider>
  )
}

export function useProductTour(): ProductTourContextValue | null {
  return useContext(ProductTourContext)
}
