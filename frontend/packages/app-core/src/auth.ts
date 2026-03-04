const TOKEN_KEY = 'kanban_access_token'
const USER_KEY = 'kanban_user'

interface UserInfo {
  login: string
  name: string
  avatar_url: string
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

/** Get GitHub access_token */
export function getAccessToken(): string | null {
  return getToken()
}

/** Get user info from localStorage */
export function getUserInfo(): UserInfo | null {
  const user = localStorage.getItem(USER_KEY)
  if (!user) return null
  try {
    return JSON.parse(user)
  } catch {
    return null
  }
}

/** Set user info */
export function setUserInfo(user: UserInfo) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Verify token is still valid by checking with GitHub */
export async function verifyToken(): Promise<boolean> {
  const token = getToken()
  if (!token) return false

  try {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'supercrew-kanban' },
    })
    return res.ok
  } catch {
    return false
  }
}
