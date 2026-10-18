import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

const router = () => createRouter({ routeTree, context: { queryClient: new QueryClient() } });

describe("Rotas do menu lateral", () => {
  it.each(["/", "/articles", "/categories", "/favorites", "/sources"])("%s existe", (path) => {
    expect(router().matchRoutes(path).at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("rota desconhecida cai no 404 do root", () => {
    expect(router().matchRoutes("/nao-existe").at(-1)?.routeId).toBe(rootRouteId);
  });

  it("/articles valida e normaliza os parâmetros de busca da URL", () => {
    const match = router()
      .matchRoutes("/articles", {
        q: "rust",
        period: "banana",
        page: "abc",
        category: " ",
        feedId: "f1",
      })
      .at(-1);
    expect(match?.search).toMatchObject({ q: "rust", feedId: "f1" });
    expect(match?.search).toMatchObject({
      period: undefined,
      page: undefined,
      category: undefined,
    });
  });

  it("/articles aceita período e página válidos", () => {
    const match = router().matchRoutes("/articles", { period: "7d", page: 3 }).at(-1);
    expect(match?.search).toMatchObject({ period: "7d", page: 3 });
  });
});
