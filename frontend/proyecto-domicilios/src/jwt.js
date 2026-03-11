// Decodifica el payload del JWT (solo para UI; NO valida firma).
export function decodeJwtPayload(token) {
  if (!token) return null
  const parts = String(token).split('.')
  if (parts.length < 2) return null
  const base64Url = parts[1]
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  try {
    const json = atob(padded)
    return JSON.parse(json)
  } catch {
    return null
  }
}

