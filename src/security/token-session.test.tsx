import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TokenSessionProvider, useTokenSession } from './token-session'

function Harness() {
  const { token, setToken } = useTokenSession()
  return (
    <>
      <output>{token ?? 'empty'}</output>
      <button type="button" onClick={() => setToken('memory-only-secret')}>
        Set token
      </button>
    </>
  )
}

describe('TokenSessionProvider', () => {
  it('keeps the token in React memory without touching persistent browser storage', async () => {
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    const indexedDbOpen = vi.spyOn(indexedDB, 'open')
    const user = userEvent.setup()
    const view = render(
      <TokenSessionProvider>
        <Harness />
      </TokenSessionProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Set token' }))

    expect(screen.getByText('memory-only-secret')).toBeInTheDocument()
    expect(storageWrite).not.toHaveBeenCalled()
    expect(indexedDbOpen).not.toHaveBeenCalled()
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)

    view.unmount()
    storageWrite.mockRestore()
    indexedDbOpen.mockRestore()
  })
})
