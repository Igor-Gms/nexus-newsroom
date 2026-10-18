import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Recarrega os módulos para que VITE_API_BASE_URL seja lido com o valor do teste. */
async function load() {
  vi.resetModules();
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test/");
  const [{ httpApi }, client] = await Promise.all([
    import("@/services/http-api"),
    import("@/services/api-client"),
  ]);
  return { httpApi, ...client };
}

beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
});

describe("httpApi (contrato com o backend Rust)", () => {
  it("lista artigos enviando apenas os filtros informados (camelCase)", async () => {
    const { httpApi } = await load();
    fetchMock.mockResolvedValue(json({ items: [], total: 0 }));

    await httpApi.articles.list({
      unread: true,
      feedId: "f1",
      period: "7d",
      limit: 6,
      q: undefined,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.test/api/articles?feedId=f1&period=7d&unread=true&limit=6",
    );
  });

  it("cadastra fonte com POST e corpo JSON", async () => {
    const { httpApi } = await load();
    fetchMock.mockResolvedValue(json({ id: "1", title: "Blog" }, 201));

    await httpApi.feeds.create({ url: "https://x.com/feed.xml", category: "Tecnologia" });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://api.test/api/feeds");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      url: "https://x.com/feed.xml",
      category: "Tecnologia",
    });
  });

  it("favoritar e marcar como lido enviam o valor explícito", async () => {
    const { httpApi } = await load();
    fetchMock.mockImplementation(() => Promise.resolve(json({}))); // uma Response nova por chamada

    await httpApi.articles.setFavorite("a 1", true);
    await httpApi.articles.setRead("a 1", false);

    const [favUrl, favInit] = fetchMock.mock.calls[0] ?? [];
    const [readUrl, readInit] = fetchMock.mock.calls[1] ?? [];
    expect(favUrl).toBe("http://api.test/api/articles/a%201/favorite");
    expect(JSON.parse(favInit.body)).toEqual({ favorite: true });
    expect(readUrl).toBe("http://api.test/api/articles/a%201/read");
    expect(JSON.parse(readInit.body)).toEqual({ read: false });
  });

  it("remover aceita resposta 204 sem corpo", async () => {
    const { httpApi } = await load();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(httpApi.feeds.remove("1")).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0]?.[1].method).toBe("DELETE");
  });

  it("mostra a mensagem de erro no formato { error: { message } } da API Rust", async () => {
    const { httpApi } = await load();
    fetchMock.mockResolvedValue(
      json(
        { error: { code: "invalid_feed", message: "o conteúdo não é um feed RSS/Atom válido" } },
        422,
      ),
    );
    await expect(httpApi.feeds.create({ url: "https://x.com" })).rejects.toMatchObject({
      name: "ApiError",
      status: 422,
      message: "o conteúdo não é um feed RSS/Atom válido",
    });
  });

  it("explica quando a API está fora do ar", async () => {
    const { httpApi } = await load();
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(httpApi.feeds.list()).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining("conectar"),
    });
  });
});

describe("extractErrorMessage", () => {
  it("aceita os formatos conhecidos e cai no fallback", async () => {
    const { extractErrorMessage } = await load();
    expect(extractErrorMessage({ error: { message: "a" } }, "x")).toBe("a");
    expect(extractErrorMessage({ message: "b" }, "x")).toBe("b");
    expect(extractErrorMessage({ error: "c" }, "x")).toBe("c");
    expect(extractErrorMessage({ error: {} }, "x")).toBe("x");
    expect(extractErrorMessage(null, "x")).toBe("x");
    expect(extractErrorMessage("texto", "x")).toBe("x");
  });
});
