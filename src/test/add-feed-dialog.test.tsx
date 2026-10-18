import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AddFeedDialog } from "@/components/nexus/AddFeedDialog";
import { ApiError } from "@/services/api-client";
import { api } from "@/services";
import type { Feed } from "@/types/nexus";

const feed = (url: string): Feed => ({
  id: "f1",
  title: "Blog Exemplo",
  url,
  category: "Tecnologia",
  status: "active",
  articleCount: 3,
  createdAt: "2026-10-18T10:00:00Z",
});

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AddFeedDialog open onClose={() => {}} />
    </QueryClientProvider>,
  );
}

const type = (value: string) =>
  fireEvent.change(screen.getByLabelText("Endereço do site ou do feed"), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Buscar e adicionar" }));

afterEach(() => vi.restoreAllMocks());

describe("AddFeedDialog", () => {
  it("completa o https:// e avisa quando o feed foi encontrado automaticamente", async () => {
    const create = vi
      .spyOn(api.feeds, "create")
      .mockResolvedValue(feed("https://exemplo.com.br/rss.xml"));
    renderDialog();

    type("exemplo.com.br");
    submit();

    expect(await screen.findByText(/Feed encontrado: Blog Exemplo/)).toBeInTheDocument();
    expect(screen.getByText(/Encontramos o feed automaticamente/)).toBeInTheDocument();
    expect(screen.getByText("https://exemplo.com.br/rss.xml")).toBeInTheDocument();
    expect(create).toHaveBeenCalledWith({
      url: "https://exemplo.com.br",
      category: expect.any(String),
    });
  });

  it("não fala em busca automática quando o usuário colou o feed direto", async () => {
    vi.spyOn(api.feeds, "create").mockResolvedValue(feed("https://exemplo.com/feed.xml"));
    renderDialog();

    type("https://exemplo.com/feed.xml");
    submit();

    expect(await screen.findByText(/Fonte validada: Blog Exemplo/)).toBeInTheDocument();
    expect(screen.queryByText(/Encontramos o feed automaticamente/)).not.toBeInTheDocument();
  });

  it("mostra a mensagem da API quando o site não tem feed", async () => {
    vi.spyOn(api.feeds, "create").mockRejectedValue(
      new ApiError(
        "não encontramos nenhum feed RSS ou Atom em exemplo.com. O site pode não oferecer feed.",
        422,
      ),
    );
    renderDialog();

    type("exemplo.com");
    submit();

    const alert = await screen.findByText(/Não encontramos nenhum feed RSS ou Atom em exemplo.com/);
    expect(alert).toBeInTheDocument(); // primeira letra maiúscula
    expect(screen.getByRole("button", { name: "Buscar e adicionar" })).toBeEnabled(); // dá para tentar de novo
  });
});
