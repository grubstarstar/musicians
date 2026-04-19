import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getBandProfile, listBands } from '../bands/queries.js';
import { protectedProcedure, publicProcedure, router } from './trpc.js';

export const appRouter = router({
  system: router({
    ping: publicProcedure.query(() => ({
      ok: true as const,
      at: new Date().toISOString(),
    })),
    whoami: protectedProcedure.query(({ ctx }) => ctx.user),
  }),
  bands: router({
    list: protectedProcedure.query(() => listBands()),
    getById: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const profile = await getBandProfile(input.id);
        if (!profile) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Band not found' });
        }
        return profile;
      }),
  }),
});

export type AppRouter = typeof appRouter;
