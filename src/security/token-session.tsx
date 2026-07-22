import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'

interface TokenSessionValue {
  token: string | null
  setToken: (token: string) => void
  clearToken: () => void
}

const TokenSessionContext = createContext<TokenSessionValue | null>(null)

export function TokenSessionProvider({ children }: PropsWithChildren) {
  const [token, setTokenState] = useState<string | null>(null)
  const setToken = useCallback((nextToken: string) => {
    setTokenState(nextToken.trim())
  }, [])
  const clearToken = useCallback(() => setTokenState(null), [])
  const value = useMemo(
    () => ({ token, setToken, clearToken }),
    [clearToken, setToken, token],
  )

  return (
    <TokenSessionContext.Provider value={value}>
      {children}
    </TokenSessionContext.Provider>
  )
}

// This hook intentionally shares the private context owned by its provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useTokenSession() {
  const context = useContext(TokenSessionContext)
  if (!context) {
    throw new Error('useTokenSession must be used inside TokenSessionProvider.')
  }
  return context
}
