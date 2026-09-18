const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

// All product routes are URI-versioned; bump in one place when v2 lands.
const API_VERSION_PREFIX = '/v1';

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
}

async function request<T>(
  path: string,
  { method = 'GET', body, token }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token !== null && token !== undefined && token !== '') {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE_URL}${API_VERSION_PREFIX}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data: unknown =
    text.length > 0
      ? (JSON.parse(text) as unknown)
      : null;
  if (!res.ok) {
    const message =
      typeof data === 'object' && data !== null && 'message' in data
        ? String((data as { message: unknown }).message)
        : `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

export interface AuthResponse {
  accessToken: string;
  user: { id: string; email: string; name: string };
}

export interface Organization {
  id: string;
  name: string;
  role: string;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
}

export interface GeneratedKey {
  id: string;
  publicKey: string;
  key: string;
  status: string;
}

export interface ApiKeyView {
  id: string;
  publicKey: string;
  status: string;
  createdAt: string;
  revokedAt: string | null;
}

export const api = {
  register: (input: { email: string; password: string; name: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: input }),

  login: (input: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: input }),

  listOrgs: (token: string) =>
    request<Organization[]>('/orgs', { token }),

  createOrg: (token: string, name: string) =>
    request<Organization>('/orgs', { method: 'POST', body: { name }, token }),

  listProjects: (token: string, orgId: string) =>
    request<Project[]>(`/orgs/${orgId}/projects`, { token }),

  createProject: (token: string, orgId: string, name: string) =>
    request<{ project: Project; apiKey: GeneratedKey }>(
      `/orgs/${orgId}/projects`,
      { method: 'POST', body: { name }, token },
    ),

  listApiKeys: (token: string, projectId: string) =>
    request<ApiKeyView[]>(`/projects/${projectId}/api-keys`, { token }),

  generateApiKey: (token: string, projectId: string) =>
    request<GeneratedKey>(`/projects/${projectId}/api-keys`, {
      method: 'POST',
      token,
    }),

  revokeApiKey: (token: string, projectId: string, keyId: string) =>
    request<ApiKeyView>(`/projects/${projectId}/api-keys/${keyId}`, {
      method: 'DELETE',
      token,
    }),

  rotateApiKey: (token: string, projectId: string, keyId: string) =>
    request<{ apiKey: GeneratedKey; revokedKeyId: string }>(
      `/projects/${projectId}/api-keys/${keyId}/rotate`,
      { method: 'POST', token },
    ),
};
