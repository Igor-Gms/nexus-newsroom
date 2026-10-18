# Nexus Newsroom

Crie uma aplicação web chamada NEXUS FEED, um agregador de notícias RSS com visual futurista premium.

Identidade visual

Dark mode como padrão.

Fundo preto-azulado e superfícies em grafite.

Gradientes em roxo, violeta e ciano.

Efeitos glassmorphism discretos, com transparências e bordas sutis.

Brilhos neon moderados, sombras suaves e animações fluidas.

Tipografia moderna, excelente legibilidade e layout responsivo.

Evite excesso de efeitos: o resultado deve parecer um produto profissional real.

Tecnologias

React com TypeScript.

Tailwind CSS.

Componentes reutilizáveis.

Lucide para ícones.

Framer Motion ou solução compatível para animações.

Organize o código para integrar futuramente a um backend REST desenvolvido em Rust com Axum.

Layout

Sidebar com logotipo NEXUS FEED, Início, Todas as notícias, Categorias, Favoritos e Fontes RSS.

Cabeçalho com busca global, indicador de atualização e avatar ou menu de perfil.

Área principal com saudação, resumo das notícias e botão para adicionar uma fonte.

Grade de artigos com título, descrição, nome da fonte, data, categoria e imagem quando disponível.

Filtros por categoria, fonte e período.

Ações para favoritar, marcar como lido e abrir o artigo original.

Modal para cadastrar uma fonte RSS por URL, mostrar o resultado da validação e permitir removê-la.

Estados de carregamento, lista vazia, erro de conexão e ausência de resultados.

Integração com Rust

Prepare uma camada de serviços TypeScript para consumir uma API REST externa, configurada pela variável VITE_API_BASE_URL.

Planeje estes endpoints:

GET /api/feeds

POST /api/feeds

DELETE /api/feeds/:id

GET /api/articles

GET /api/articles/:id

POST /api/articles/:id/favorite

POST /api/articles/:id/read

POST /api/feeds/:id/refresh

Defina tipos TypeScript para feeds e artigos. Não implemente um backend fictício em Rust dentro do frontend. Enquanto a API não estiver conectada, use dados demonstrativos claramente separados dos serviços reais e facilite sua substituição.

Qualidade

Todos os botões e filtros devem ter comportamento funcional.

Use componentes reutilizáveis e código organizado.

Priorize acessibilidade, responsividade e desempenho.

Não exiba notícias falsas como se fossem dados reais.

Inclua instruções de configuração e execução no README.

Entregue a interface completa, pronta para ser conectada a um backend Rust independente.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f596e4dc-e8a7-4c3c-bb45-50e6baacf171).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
