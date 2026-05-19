import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveSession,
  loadSession,
  clearSession,
} from '../../../src/services/workspace-store'

beforeEach(() => {
  localStorage.clear()
})

describe('saveSession / loadSession roundtrip', () => {
  it('returns null when no session saved', () => {
    expect(loadSession()).toBeNull()
  })

  it('saves and loads session correctly', () => {
    saveSession()
    const session = loadSession()
    expect(session).not.toBeNull()
    expect(session!.version).toBe(1)
    expect(session!.theme).toBeTruthy()
    expect(Array.isArray(session!.tabs)).toBe(true)
    expect(session!.sidebar).toBeDefined()
  })

  it('handles corrupted data gracefully', () => {
    localStorage.setItem('confucius-workspace-session', '{bad json')
    expect(loadSession()).toBeNull()
    expect(localStorage.getItem('confucius-workspace-session')).toBeNull()
  })

  it('ignores unknown versions', () => {
    localStorage.setItem(
      'confucius-workspace-session',
      JSON.stringify({ version: 999, tabs: [] }),
    )
    expect(loadSession()).toBeNull()
  })
})
