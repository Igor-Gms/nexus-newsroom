import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArticleList } from "@/components/nexus/ArticleList";
import { PaginationBar } from "@/components/nexus/PaginationBar";
import { StatCard } from "@/components/nexus/StatCard";
import { api } from "@/services";
import { Newspaper } from "lucide-react";

const wrap = (ui: React.ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

afterEach(() => vi.restoreAllMocks());

describe("ArticleList", () => {
  it("mostra os artigos retornados pela API", async () => {
    vi.spyOn(api.articles, "list").mockResolvedValue({
      items: [
        {
          id: "a1",
          feedId: "f1",
          feedTitle: "Blog Exemplo",
          title: "Notícia da API",
          summary: "Resumo retornado pela API.",
          url: "https://example.com/article",
          category: "Tecnologia",
          publishedAt: new Date().toISOString(),
          isRead: false,
          isFavorite: false,
        },
      ],
      total: 1,
      page: 1,
      limit: 3,
      totalPages: 1,
    });
    wrap(<ArticleList query={{ limit: 3 }} />);
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(1), { timeout: 3000 });
  });

  it("mostra erro de conexão com botão para tentar de novo", async () => {
    vi.spyOn(api.articles, "list").mockRejectedValue(new Error("API fora do ar"));
    wrap(<ArticleList query={{}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("API fora do ar");
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });

  it("diferencia lista vazia de ausência de resultados", async () => {
    vi.spyOn(api.articles, "list").mockResolvedValue({ items: [], total: 0 });
    const { unmount } = wrap(<ArticleList query={{}} />);
    expect(await screen.findByText("Nenhum artigo ainda")).toBeInTheDocument();
    unmount();

    wrap(<ArticleList query={{ q: "xyz" }} hasFilters />);
    expect(await screen.findByText("Nenhum resultado")).toBeInTheDocument();
  });

  it("exibe a paginação quando há mais de uma página", async () => {
    const onPageChange = vi.fn();
    vi.spyOn(api.articles, "list").mockResolvedValue({ items: [], total: 0 });
    wrap(<PaginationBar page={2} totalPages={3} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole("button", { name: /próxima/i }));
    fireEvent.click(screen.getByRole("button", { name: /anterior/i }));
    expect(onPageChange).toHaveBeenNthCalledWith(1, 3);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 1);
  });
});

describe("PaginationBar", () => {
  it("desabilita os extremos", () => {
    render(<PaginationBar page={1} totalPages={1} onPageChange={() => {}} />);
    expect(screen.getByRole("button", { name: /anterior/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /próxima/i })).toBeDisabled();
    expect(screen.getByText("Página 1 de 1")).toBeInTheDocument();
  });
});

describe("StatCard", () => {
  it("formata o número e mostra esqueleto enquanto carrega", () => {
    const { rerender } = render(<StatCard label="Artigos" value={1234} icon={Newspaper} />);
    expect(screen.getByText("1.234")).toBeInTheDocument();
    rerender(<StatCard label="Artigos" value={undefined} loading icon={Newspaper} />);
    expect(screen.getByLabelText("Carregando")).toBeInTheDocument();
  });
});
