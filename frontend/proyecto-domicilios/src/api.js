function getToken() {
  return localStorage.getItem('token') || ''
}

export function setToken(token) {
  if (!token) {
    localStorage.removeItem('token')
    return
  }
  localStorage.setItem('token', token)
}

export function getAuthHeader() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = {
    ...getAuthHeader(),
  }

  let payload
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  const res = await fetch(path, { method, headers, body: payload })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  if (!res.ok) {
    const message = (data && (data.error || data.message)) || `HTTP ${res.status}`
    const err = new Error(message)
    err.status = res.status
    err.data = data
    throw err
  }

  return data
}

