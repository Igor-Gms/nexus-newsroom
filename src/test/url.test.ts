import { describe, expect, it } from "vitest";
import { capitalize, isSameUrl, normalizeUserUrl } from "@/lib/url";

describe("normalizeUserUrl", () => {
  it("completa o esquema quando o usuário digita só o domínio", () => {
    expect(normalizeUserUrl("exemplo.com.br")).toBe("https://exemplo.com.br");
    expect(normalizeUserUrl("  exemplo.com/blog  ")).toBe("https://exemplo.com/blog");
    expect(normalizeUserUrl("localhost:3000/feed")).toBe("https://localhost:3000/feed");
  });

  it("mantém endereços que já têm esquema", () => {
    expect(normalizeUserUrl("http://exemplo.com/feed.xml")).toBe("http://exemplo.com/feed.xml");
    expect(normalizeUserUrl("HTTPS://Exemplo.com")).toBe("HTTPS://Exemplo.com");
    expect(normalizeUserUrl("")).toBe("");
    expect(normalizeUserUrl("   ")).toBe("");
  });
});

describe("isSameUrl", () => {
  it("ignora barra final e caixa do domínio", () => {
    expect(isSameUrl("https://exemplo.com", "https://exemplo.com/")).toBe(true);
    expect(isSameUrl("https://EXEMPLO.com/feed", "https://exemplo.com/feed/")).toBe(true);
  });

  it("diferencia endereços de verdade", () => {
    expect(isSameUrl("https://exemplo.com", "https://exemplo.com/feed")).toBe(false);
    expect(isSameUrl("http://exemplo.com", "https://exemplo.com")).toBe(false);
  });
});

describe("capitalize", () => {
  it("coloca a primeira letra em maiúscula", () => {
    expect(capitalize("não encontramos")).toBe("Não encontramos");
    expect(capitalize("")).toBe("");
  });
});
