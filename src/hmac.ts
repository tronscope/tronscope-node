import { createHash, createHmac } from 'node:crypto';

/** Sort + encode query the same way the Platform API verifies signatures. */
export function canonicalQuery(search: string): string {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  if (!raw) return '';
  return raw
    .split('&')
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf('=');
      if (eq < 0) {
        return [decodeURIComponent(part), ''] as const;
      }
      return [
        decodeURIComponent(part.slice(0, eq)),
        decodeURIComponent(part.slice(eq + 1)),
      ] as const;
    })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function signaturePayload(input: {
  timestamp: string;
  method: string;
  path: string;
  query?: string;
  rawBody?: string;
}): string {
  return [
    input.timestamp,
    input.method.toUpperCase(),
    input.path,
    canonicalQuery(input.query || ''),
    sha256Hex(input.rawBody || ''),
  ].join('\n');
}

export function signRequest(input: {
  secret: string;
  timestamp: string;
  method: string;
  path: string;
  query?: string;
  rawBody?: string;
}): string {
  return hmacSha256Hex(input.secret, signaturePayload(input));
}
