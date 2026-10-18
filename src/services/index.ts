import { isApiConfigured } from "./api-client";
import type { NexusApi } from "./contract";
import { demoApi } from "./demo/demo-api";
import { httpApi } from "./http-api";

/** Uses the real REST API when VITE_API_BASE_URL is set, demo data otherwise. */
export const api: NexusApi = isApiConfigured ? httpApi : demoApi;
export const isDemoMode = !isApiConfigured;

export const CATEGORIES = [
  "Tecnologia",
  "Ciência",
  "Negócios",
  "Design",
  "Cultura",
  "Mundo",
] as const;

export { ApiError } from "./api-client";
