import { describe, expect, it } from "vitest";
import { demoApi } from "@/services/demo/demo-api";

describe("demoApi (modo demonstração)", () => {
  it("filtra apenas não lidos", async () => {
    const before = await demoApi.articles.list({ unread: true });
    expect(before.items.every((a) => !a.isRead)).toBe(true);
    expect(before.total).toBeGreaterThan(0);

    await demoApi.articles.setRead(before.items[0]!.id, true);

    const after = await demoApi.articles.list({ unread: true });
    expect(after.total).toBe(before.total - 1);
  });

  it("pagina os resultados", async () => {
    const all = await demoApi.articles.list({});
    const page2 = await demoApi.articles.list({ limit: 2, page: 2 });
    expect(page2.items).toHaveLength(Math.min(2, Math.max(0, all.total - 2)));
    expect(page2.page).toBe(2);
    expect(page2.totalPages).toBe(Math.max(1, Math.ceil(all.total / 2)));
  });

  it("encontra o feed a partir do endereço do site (simulação)", async () => {
    const feed = await demoApi.feeds.create({ url: "https://meusite.exemplo.com/pagina" });
    expect(feed.url).toBe("https://meusite.exemplo.com/feed");
    // Colar o site de novo é duplicata.
    await expect(
      demoApi.feeds.create({ url: "https://meusite.exemplo.com/" }),
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  it("explica quando o site não tem feed e rejeita URLs inválidas", async () => {
    await expect(demoApi.feeds.create({ url: "https://vazio.exemplo.com/" })).rejects.toMatchObject(
      {
        status: 422,
        message: expect.stringContaining("não encontramos nenhum feed"),
      },
    );
    await expect(demoApi.feeds.create({ url: "isso-nao-e-url" })).rejects.toMatchObject({
      status: 422,
    });
  });
});
