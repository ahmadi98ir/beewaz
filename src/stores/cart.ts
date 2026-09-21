import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type CartItem = {
  id: string
  slug: string
  categorySlug: string
  nameFa: string
  sku: string
  price: number
  comparePrice?: number
  quantity: number
  placeholderFrom: string
  placeholderTo: string
}

type CartStore = {
  items: CartItem[]
  isOpen: boolean

  addItem: (item: Omit<CartItem, 'quantity'>) => void
  addItemQuantity: (item: Omit<CartItem, 'quantity'>, quantity: number) => void
  ensureItemQuantity: (item: Omit<CartItem, 'quantity'>, quantity: number) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  openCart: () => void
  closeCart: () => void
}

export const useCart = create<CartStore>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,

      addItem: (newItem) => {
        set((state) => {
          const existing = state.items.find((i) => i.id === newItem.id)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === newItem.id ? { ...i, quantity: i.quantity + 1 } : i,
              ),
            }
          }
          return { items: [...state.items, { ...newItem, quantity: 1 }] }
        })
      },

      addItemQuantity: (newItem, requestedQuantity) => {
        const quantity = Math.max(1, Math.min(999, Math.trunc(requestedQuantity || 1)))
        set((state) => {
          const existing = state.items.find((i) => i.id === newItem.id)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === newItem.id
                  ? { ...i, ...newItem, quantity: i.quantity + quantity }
                  : i,
              ),
            }
          }
          return { items: [...state.items, { ...newItem, quantity }] }
        })
      },

      ensureItemQuantity: (newItem, requestedQuantity) => {
        const quantity = Math.max(1, Math.min(999, Math.trunc(requestedQuantity || 1)))
        set((state) => {
          const existing = state.items.find((i) => i.id === newItem.id)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === newItem.id
                  ? { ...i, ...newItem, quantity: Math.max(i.quantity, quantity) }
                  : i,
              ),
            }
          }
          return { items: [...state.items, { ...newItem, quantity }] }
        })
      },

      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      updateQuantity: (id, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.id !== id)
              : state.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
        })),

      clearCart: () => set({ items: [] }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
    }),
    {
      name: 'beewaz-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
)

// Selectors — use these instead of s.count / s.subtotal
export const cartCount = (s: CartStore) =>
  s.items.reduce((sum, i) => sum + i.quantity, 0)

export const cartSubtotal = (s: CartStore) =>
  s.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
