/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base da API REST em Rust. Em desenvolvimento, usa localhost:3000 por padrão. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
