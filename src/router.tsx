import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // retry: 1 -> se a API estiver fora do ar, o erro aparece em ~1s (o padrão são 3 tentativas com espera).
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
