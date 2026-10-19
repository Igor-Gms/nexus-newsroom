import type { NexusApi } from "./contract";
import { httpApi } from "./http-api";

/** A interface sempre usa a API REST real em Rust. */
export const api: NexusApi = httpApi;

export const CATEGORIES = [
  "Tecnologia",
  "Ciência",
  "Negócios",
  "Design",
  "Cultura",
  "Mundo",
] as const;

export { ApiError } from "./api-client";
