import { Hono } from 'hono'
import { cors } from 'hono/cors'

// Environment variables
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? ''
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? ''
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001'
const PORT = parseInt(process.env.PORT ?? '3001')

export const app = new Hono()

app.use('*', cors({
  origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:5174'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Redirect to GitHub OAuth
app.get('/auth/github', (c) => {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    scope: 'read:user repo',
    redirect_uri: `${BACKEND_URL}/auth/callback`,
    prompt: 'consent', // Force re-authorization every time
  })
  return c.redirect(`https://github.com/login/oauth/authorize?${params}`)
})

// GitHub OAuth callback - exchange code for token
app.get('/auth/callback', async (c) => {
  const code = c.req.query('code')
  const ghError = c.req.query('error')

  if (!code) {
    return c.redirect(`${FRONTEND_URL}/login?error=${ghError ?? 'no_code'}`)
  }

  // Exchange code for access_token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
    }),
  })
  const { access_token, error } = await tokenRes.json() as any

  if (error || !access_token) {
    return c.redirect(`${FRONTEND_URL}/login?error=token_failed`)
  }

  // Get GitHub user info
  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${access_token}`, 'User-Agent': 'supercrew-kanban' },
  })
  const ghUser = await userRes.json() as any

  // Return access_token and user info via URL params
  // Frontend will store these in localStorage
  const params = new URLSearchParams({
    access_token,
    login: ghUser.login,
    name: ghUser.name ?? ghUser.login,
    avatar_url: ghUser.avatar_url,
  })

  return c.redirect(`${FRONTEND_URL}/oauth-callback?${params}`)
})

app.get('/health', (c) => c.json({ ok: true }))

// Bun serves when it sees default export with { port, fetch }
export default {
  port: PORT,
  fetch: app.fetch,
}
