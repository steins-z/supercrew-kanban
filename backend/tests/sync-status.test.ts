import { describe, it, expect, beforeAll } from 'bun:test'
import { app } from '../src/index'

describe('GET /api/board/sync/status', () => {
  it('should return sync status metadata', async () => {
    const res = await app.request('/api/board/sync/status')
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data).toHaveProperty('lastSync')
    expect(data).toHaveProperty('featureCount')
    expect(data).toHaveProperty('source')
    expect(data.source).toBe('database')
  })
})
