const AUTH_TOKEN_KEY = "outreach-dashboard-token";
const TOKEN_REGEX = /^[A-Za-z0-9_-]{43,128}$/;

export function getStoredToken(): string {
  if (typeof window === "undefined") return "";

  // Check URL fragment first (e.g. #token=...)
  if (window.location.hash) {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const fragmentToken = params.get("token");
    if (fragmentToken && TOKEN_REGEX.test(fragmentToken)) {
      setStoredToken(fragmentToken);
      // Clean hash from URL bar
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      return fragmentToken;
    }
  }

  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setStoredToken(token: string): boolean {
  if (!TOKEN_REGEX.test(token.trim())) return false;
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token.trim());
    sessionStorage.setItem(AUTH_TOKEN_KEY, token.trim());
    return true;
  } catch {
    return false;
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Ignore private browsing restrictions
  }
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  headers.set("Accept", "application/json");
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.body && typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const rawText = await response.text();
  let parsed: any = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const message =
      parsed?.message ||
      parsed?.error ||
      parsed?.detail ||
      rawText ||
      `HTTP ${response.status}: Request failed`;
    throw new ApiError(message, response.status, parsed || { message: rawText });
  }

  if (parsed !== null) {
    return parsed as T;
  }

  return rawText as unknown as T;
}

