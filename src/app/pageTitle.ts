import { createContext, useContext, useEffect } from 'react'

/**
 * Lets a page replace the shell's heading with something only it knows — a team's name, and
 * later a board's or a card's. Route handles are static, so they cannot carry loaded data.
 */
export const PageTitleContext = createContext<((title: string | null) => void) | null>(null)

export function useSetPageTitle(title: string | null | undefined): void {
  const setTitle = useContext(PageTitleContext)
  useEffect(() => {
    if (!setTitle) return
    setTitle(title ?? null)
    return () => setTitle(null)
  }, [setTitle, title])
}
