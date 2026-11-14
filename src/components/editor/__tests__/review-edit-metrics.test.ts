import { describe, expect, it } from 'vitest'
import { summarizeDraftEditMetrics } from '../review-edit-metrics'

describe('summarizeDraftEditMetrics', () => {
  it('returns empty metrics without dividing by zero', () => {
    expect(summarizeDraftEditMetrics([])).toEqual({
      saveCount: 0,
      authorActions: 0,
      changedPerKChars: '—',
    })
  })

  it('counts empty human saves as saves but not author actions', () => {
    expect(summarizeDraftEditMetrics([
      { origin: 'human', changed_chars: 0, new_chars: 100 },
      { origin: 'human', changed_chars: 0, new_chars: 80 },
    ])).toEqual({
      saveCount: 2,
      authorActions: 0,
      changedPerKChars: '0.0',
    })
  })

  it('keeps AI rows out of author actions and tolerates new_chars = 0', () => {
    expect(summarizeDraftEditMetrics([
      { origin: 'human', changed_chars: 10, new_chars: 100 },
      { origin: 'human', changed_chars: 5, new_chars: 0 },
      { origin: 'ai', changed_chars: 50, new_chars: 1000 },
    ])).toEqual({
      saveCount: 3,
      authorActions: 2,
      changedPerKChars: '150.0',
    })
  })

  it('uses only human new_chars as the per-1k denominator', () => {
    expect(summarizeDraftEditMetrics([
      { origin: 'human', changed_chars: 30, new_chars: 1000 },
      { origin: 'human', changed_chars: 12, new_chars: 500 },
      { origin: 'ai', changed_chars: 99, new_chars: 2000 },
    ])).toEqual({
      saveCount: 3,
      authorActions: 2,
      changedPerKChars: '28.0',
    })
  })
})
