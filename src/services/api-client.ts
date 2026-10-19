// Thin fetch wrapper for the external Rust/Axum REST API.
const DEFAULT_API_BASE_URL = import.meta.env.DEV ? "http://localhost:3000" : "";
const RAW_BASE = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL;
export const API_BASE_URL = RAW_BASE.replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Extrai a mensagem de erro do corpo da resposta.
 * Formato da API Rust: { "error": { "code": "...", "message": "..." } }.
 * Também aceita { "message": "..." } e { "error": "..." }.
 */
export function extractErrorMessage(body: unknown, fallback: string): string {
  if (typeof body !== "object" || body === null) return fallback;
  const { error, message } = body as { error?: unknown; message?: unknown };
  if (typeof error === "object" && error !== null) {
    const nested = (error as { message?: unknown }).message;
    if (typeof nested === "string" && nested) return nested;
  }
  if (typeof message === "string" && message) return message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { Accept: "application/json", "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(
      "Não foi possível conectar à API. Verifique se o servidor está em execução.",
      0,
    );
  }
  if (!res.ok) {
    let message = `Erro ${res.status}`;
    try {
      message = extractErrorMessage(await res.json(), message);
    } catch {
      /* body não é JSON */
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function toQueryString(params: Record<string, string | number | boolean | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}
