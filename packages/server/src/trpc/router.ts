import { protectedProcedure, publicProcedure, router } from './trpc.js';

export const appRouter = router({
  system: router({
    ping: publicProcedure.query(() => ({
      ok: true as const,
      at: new Date().toISOString(),
    })),
    whoami: protectedProcedure.query(({ ctx }) => ctx.user),
  }),
});

export type AppRouter = typeof appRouter;
