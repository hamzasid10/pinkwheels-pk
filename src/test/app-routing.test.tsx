import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import { Route as dashboardRoute } from "@/routes/_authenticated/dashboard";
import { supabase } from "@/integrations/supabase/client";

import { routeTree } from "@/routeTree.gen";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("keeps booking and ride history as separate existing pages", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes("/book").at(-1)?.routeId).toBe("/_authenticated/book");
    expect(router.matchRoutes("/rider").at(-1)?.routeId).toBe("/_authenticated/rider");
  });

  it("opens rider default entry on booking", async () => {
    const eq = vi.fn().mockResolvedValue({ data: [{ role: "rider" }] });
    const from = vi.spyOn(supabase, "from").mockReturnValue({ select: () => ({ eq }) } as never);
    try {
      const beforeLoad = dashboardRoute.options.beforeLoad;
      if (typeof beforeLoad !== "function") throw new Error("Missing dashboard role redirect");
      await expect(beforeLoad({ context: { user: { id: "test-rider" } } } as never)).rejects.toMatchObject({ options: { to: "/book" } });
    } finally {
      from.mockRestore();
    }
  });
});
