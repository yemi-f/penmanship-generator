const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getAuthToken(): Promise<string> {
  const res = await fetch("/api/auth/token");
  if (!res.ok) {
    throw new Error("Not authenticated");
  }
  const { token } = (await res.json()) as { token: string };
  return token;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAuthToken();
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}
