/**
 * Aceita endereços digitados sem o esquema ("exemplo.com.br") e devolve "https://exemplo.com.br".
 * A API exige o esquema (http/https), então a interface o completa para o usuário.
 */
export function normalizeUserUrl(input: string): string {
  const value = input.trim();
  if (!value) return value;
  return /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;
}

const withoutTrailingSlash = (url: string) => url.replace(/\/+$/, "");

/** Compara dois endereços ignorando diferenças que não mudam o destino (barra final, domínio em maiúsculas). */
export function isSameUrl(a: string, b: string): boolean {
  try {
    return withoutTrailingSlash(new URL(a).href) === withoutTrailingSlash(new URL(b).href);
  } catch {
    return a === b;
  }
}

/** As mensagens da API começam em minúscula; na tela ficam melhores com a primeira letra maiúscula. */
export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
