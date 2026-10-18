/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base da API REST em Rust (ex.: http://localhost:3000). Vazia = modo demonstração. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
