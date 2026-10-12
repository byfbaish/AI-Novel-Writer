import { describe, expect, it } from 'vitest'
import { createDebugStore, DEBUG_STORAGE_KEY, type DebugStorage } from '../debug-store'

function memoryStorage(seed?: Record<string, string>): DebugStorage & { dump: () => Record<string, string> } {
  const map = new Map<string, string>(Object.entries(seed ?? {}))
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value) },
    dump: () => Object.fromEntries(map),
  }
}

describe('debug store', () => {
  it('defaults to tracing off with no custom root when nothing is stored', () => {
    const store = createDebugStore(memoryStorage())
    expect(store.getState().promptTraceEnabled).toBe(false)
    expect(store.getState().traceRoot).toBeNull()
  })

  it('persists the prompt-trace toggle under a stable key', () => {
    const storage = memoryStorage()
    const store = createDebugStore(storage)
    store.getState().setPromptTraceEnabled(true)
    expect(JSON.parse(storage.dump()[DEBUG_STORAGE_KEY])).toMatchObject({ promptTraceEnabled: true })
  })

  it('normalizes a blank trace root back to null', () => {
    const storage = memoryStorage()
    const store = createDebugStore(storage)
    store.getState().setTraceRoot('   ')
    expect(store.getState().traceRoot).toBeNull()
    store.getState().setTraceRoot('D:/trace')
    expect(store.getState().traceRoot).toBe('D:/trace')
  })

  it('restores a previously persisted configuration', () => {
    const storage = memoryStorage({
      [DEBUG_STORAGE_KEY]: JSON.stringify({ promptTraceEnabled: true, traceRoot: 'D:/trace' }),
    })
    const store = createDebugStore(storage)
    expect(store.getState().promptTraceEnabled).toBe(true)
    expect(store.getState().traceRoot).toBe('D:/trace')
  })

  it('falls back to defaults when the stored value is corrupt', () => {
    const store = createDebugStore(memoryStorage({ [DEBUG_STORAGE_KEY]: '{broken' }))
    expect(store.getState().promptTraceEnabled).toBe(false)
    expect(store.getState().traceRoot).toBeNull()
  })

  it('does not drop the retained root when the toggle flips', () => {
    const storage = memoryStorage()
    const store = createDebugStore(storage)
    store.getState().setTraceRoot('D:/trace')
    store.getState().setPromptTraceEnabled(true)
    expect(store.getState().traceRoot).toBe('D:/trace')
    expect(JSON.parse(storage.dump()[DEBUG_STORAGE_KEY])).toMatchObject({
      promptTraceEnabled: true,
      traceRoot: 'D:/trace',
    })
  })
})
