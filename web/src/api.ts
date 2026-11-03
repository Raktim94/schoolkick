export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** JSON API client. The x-requested-with header is the CSRF guard the server requires on writes. */
export async function api<T = any>(method: string, path: string, body?: unknown, contentType = 'application/json'): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      credentials: 'same-origin',
      headers: { 'x-requested-with': 'campusos', ...(body === undefined ? {} : { 'content-type': contentType }) },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'offline', 'No connection. Your changes are kept on this device; try again when you are back online.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? `Request failed (${res.status})`);
  return data as T;
}

export type Role = 'owner' | 'registrar' | 'teacher' | 'finance' | 'guardian';
export type Me = { name: string; roles: Role[]; institution: string; timezone: string };
