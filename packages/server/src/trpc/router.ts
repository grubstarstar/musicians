import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getBandProfile, listBands } from '../bands/queries.js';
import { getUpcomingEventsForBand } from '../events/queries.js';
import {
  createEoi,
  getRequestById,
  hasPendingEoiFromUser,
  respondToEoi,
} from '../requests/eoiQueries.js';
import {
  createRequest,
  getOpenRequestWithBand,
  isMemberOfBand,
  listMyRequests,
  listOpenRequests,
} from '../requests/queries.js';
import { requestKindEnum, type EoiDetails } from '../schema.js';
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
    getById: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const req = await getOpenRequestWithBand(input.id);
        if (!req) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
        }
        return req;
      }),
    // Source-side list for the Manage Requests screen (MUS-55). Unlike
    // `list` (which surfaces open requests to the community), this returns
    // *the caller's* requests regardless of status, each with its EoIs.
    listMine: protectedProcedure.query(({ ctx }) => {
      const userId = Number(ctx.user.id);
      return listMyRequests(userId);
    }),
  }),
  expressionsOfInterest: router({
    create: protectedProcedure
      .input(
        z.object({
          requestId: z.number().int().positive(),
          // Discriminated union on `kind` — mirrors requests.create. Only one
          // branch today; more kinds land with MUS-56/58.
          details: z
            .discriminatedUnion('kind', [
              z.object({
                kind: z.literal('musician-for-band'),
                notes: z.string().optional(),
              }),
            ])
            .optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const userId = Number(ctx.user.id);

        const req = await getRequestById(input.requestId);
        if (!req) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
        }
        if (req.status !== 'open') {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Request is not open',
          });
        }
        if (req.source_user_id === userId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Cannot express interest in your own request',
          });
        }
        const alreadyPending = await hasPendingEoiFromUser(input.requestId, userId);
        if (alreadyPending) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'You already have a pending expression of interest on this request',
          });
        }

        // Narrowing: `details` is typed as the discriminated union | undefined.
        // Cast to EoiDetails for the nullable column; if absent, store null.
        const details: EoiDetails | null = input.details ?? null;
        return createEoi(input.requestId, userId, details);
      }),
    respond: protectedProcedure
      .input(
        z.object({
          eoiId: z.number().int().positive(),
          decision: z.enum(['accepted', 'rejected']),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const userId = Number(ctx.user.id);
        const result = await respondToEoi({
          eoiId: input.eoiId,
          callerUserId: userId,
          decision: input.decision,
        });
        if (result.kind === 'not_found') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Expression of interest not found',
          });
        }
        if (result.kind === 'forbidden') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Only the request author can respond to expressions of interest',
          });
        }
        if (result.kind === 'not_pending') {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Expression of interest has already been decided',
          });
        }
        return result.outcome;
      }),
  }),
});

export type AppRouter = typeof appRouter;
