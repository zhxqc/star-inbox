import type { PropsWithChildren } from 'react'
import { TokenSessionProvider } from '../security/token-session'

export function AppProviders({ children }: PropsWithChildren) {
  return <TokenSessionProvider>{children}</TokenSessionProvider>
}
