import { describe, it, expect } from 'bun:test'
import { app } from '../src/index'

describe('GET /api/board/sync/status', () => {
  it('should return sync status metadata', async () => {
    const res = await app.request('/api/board/sync/status')
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data).toHaveProperty('lastSync')
    expect(data).toHaveProperty('featureCount')
    expect(data).toHaveProperty('source')
    expect(data).toHaveProperty('timestamp')
    expect(data.source).toBe('database')
  })

  it('should return valid ISO timestamp', async () => {
    const res = await app.request('/api/board/sync/status')
    const data = await res.json()

    // Validate timestamp is valid ISO 8601
    expect(data.timestamp).toBeDefined()
    expect(() => new Date(data.timestamp)).not.toThrow()
    expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp)
  })

  it('should return numeric feature count', async () => {
    const res = await app.request('/api/board/sync/status')
    const data = await res.json()

    expect(typeof data.featureCount).toBe('number')
    expect(data.featureCount).toBeGreaterThanOrEqual(0)
  })
})
