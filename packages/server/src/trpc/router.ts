import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getBandProfile, listBands } from '../bands/queries.js';
import { getUpcomingEventsForBand } from '../events/queries.js';
import { createRequest, isMemberOfBand, listOpenRequests } from '../requests/queries.js';
import { requestKindEnum } from '../schema.js';
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
  events: router({
    // Public for now per MUS-48; will flip to protectedProcedure in a later ticket.
    upcomingForBand: publicProcedure
      .input(
        z.object({
          bandId: z.number().int().positive(),
          limit: z.number().int().positive().max(100).optional(),
        }),
      )
      .query(({ input }) => getUpcomingEventsForBand(input.bandId, input.limit)),
  }),
  requests: router({
    create: protectedProcedure
      .input(
        z.discriminatedUnion('kind', [
          z.object({
            kind: z.literal('musician-for-band'),
            bandId: z.number().int().positive(),
            instrument: z.string().min(1),
            style: z.string().optional(),
            rehearsalCommitment: z.string().optional(),
          }),
        ]),
      )
      .mutation(async ({ ctx, input }) => {
        const userId = Number(ctx.user.id);
        const allowed = await isMemberOfBand(userId, input.bandId);
        if (!allowed) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You must be a member of this band to post this request',
          });
        }
        return createRequest(input, userId);
      }),
    list: protectedProcedure
      .input(z.object({ kind: z.enum(requestKindEnum.enumValues).optional() }))
      .query(({ input }) => listOpenRequests({ kind: input.kind })),
  }),
});

export type AppRouter = typeof appRouter;
