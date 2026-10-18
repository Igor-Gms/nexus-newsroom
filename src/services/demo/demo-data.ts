// DEMO ONLY — fictitious sample content. Every title is prefixed with
// "[Demo]" and links point to example.com so nothing passes as real news.
import type { Article, Feed } from "@/types/nexus";

const h = 36e5;

export function createDemoData(): { feeds: Feed[]; articles: Article[] } {
  const now = Date.now();
  const iso = (hoursAgo: number) => new Date(now - hoursAgo * h).toISOString();

  const feeds: Feed[] = [
    { id: "f1", title: "Exemplo Tech", url: "https://example.com/tech/rss.xml", siteUrl: "https://example.com", category: "Tecnologia", status: "active", articleCount: 0, lastFetchedAt: iso(0.2), createdAt: iso(400) },
    { id: "f2", title: "Exemplo Ciência", url: "https://example.org/ciencia/feed", siteUrl: "https://example.org", category: "Ciência", status: "active", articleCount: 0, lastFetchedAt: iso(1), createdAt: iso(300) },
    { id: "f3", title: "Exemplo Negócios", url: "https://example.net/negocios/atom.xml", siteUrl: "https://example.net", category: "Negócios", status: "active", articleCount: 0, lastFetchedAt: iso(3), createdAt: iso(200) },
    { id: "f4", title: "Exemplo Design", url: "https://example.com/design/feed.xml", siteUrl: "https://example.com", category: "Design", status: "active", articleCount: 0, lastFetchedAt: iso(5), createdAt: iso(150) },
    { id: "f5", title: "Exemplo Cultura", url: "https://example.org/cultura/rss", siteUrl: "https://example.org", category: "Cultura", status: "error", errorMessage: "Tempo limite excedido ao buscar o feed (exemplo).", articleCount: 0, lastFetchedAt: iso(30), createdAt: iso(100) },
  ];

  const seed: Array<[string, string, string, number]> = [
    ["f1", "Artigo de exemplo sobre processadores", "Texto demonstrativo para visualizar como um resumo de artigo aparece no cartão.", 0.5],
    ["f1", "Exemplo: guia de ferramentas para desenvolvedores", "Conteúdo fictício usado apenas para testar o layout da grade de notícias.", 4],
    ["f1", "Exemplo de notícia sobre linguagens de programação", "Resumo de demonstração. Conecte sua API para ver artigos reais das suas fontes.", 20],
    ["f1", "Exemplo: tendências em infraestrutura", "Item de amostra para validar filtros de período e categoria.", 80],
    ["f2", "Exemplo de artigo sobre astronomia", "Descrição demonstrativa que ocupa até três linhas no cartão de artigo.", 2],
    ["f2", "Exemplo: pesquisa fictícia sobre oceanos", "Conteúdo de amostra, sem relação com fatos reais.", 30],
    ["f2", "Exemplo de reportagem sobre energia", "Texto de preenchimento para pré-visualização da interface.", 200],
    ["f3", "Exemplo: análise de mercado fictícia", "Resumo de demonstração para o filtro de Negócios.", 6],
    ["f3", "Exemplo de notícia sobre startups", "Item fictício gerado localmente pelo adaptador de demonstração.", 50],
    ["f3", "Exemplo: relatório trimestral de amostra", "Dados de exemplo — substitua conectando o backend Rust.", 400],
    ["f4", "Exemplo de artigo sobre tipografia", "Texto demonstrativo sobre um tema de design, apenas para layout.", 8],
    ["f4", "Exemplo: sistemas de design em produtos", "Conteúdo fictício para exibir a categoria Design.", 100],
    ["f5", "Exemplo de resenha cultural", "Amostra da fonte com erro de atualização, para testar estados.", 40],
    ["f5", "Exemplo: agenda de eventos fictícia", "Resumo de demonstração exibido no cartão.", 600],
  ];

  const articles: Article[] = seed.map(([feedId, title, summary, hoursAgo], i) => {
    const feed = feeds.find((f) => f.id === feedId)!;
    return {
      id: `a${i + 1}`,
      feedId,
      feedTitle: feed.title,
      title: `[Demo] ${title}`,
      summary,
      url: `https://example.com/demo-article-${i + 1}`,
      category: feed.category,
      publishedAt: iso(hoursAgo),
      isRead: i % 5 === 3,
      isFavorite: i === 1 || i === 7,
    };
  });

  return { feeds, articles };
}
