import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getBandProfile, listBands } from '../bands/queries.js';
import {
  countOpenSlots,
  createGig,
  getGigById,
  listGigsByOrganiser,
} from '../gigs/queries.js';
import { getUpcomingRehearsalsForBand } from '../rehearsals/queries.js';
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
  rehearsals: router({
    // Public for now per MUS-48; will flip to protectedProcedure in a later ticket.
    upcomingForBand: publicProcedure
      .input(
        z.object({
          bandId: z.number().int().positive(),
          limit: z.number().int().positive().max(100).optional(),
        }),
      )
      .query(({ input }) => getUpcomingRehearsalsForBand(input.bandId, input.limit)),
  }),
  gigs: router({
    create: protectedProcedure
      .input(
        z.object({
          datetime: z.coerce.date(),
          venueId: z.number().int().positive(),
          doors: z.string().optional(),
          slots: z
            .array(
              z.object({
                setOrder: z.number().int().nonnegative(),
                fee: z.number().int().nonnegative().optional(),
              }),
            )
            .min(1, 'A gig must have at least one slot'),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const userId = Number(ctx.user.id);
        return createGig(input, userId);
      }),
    listMine: protectedProcedure.query(({ ctx }) => {
      const userId = Number(ctx.user.id);
      return listGigsByOrganiser(userId);
    }),
    getById: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const gig = await getGigById(input.id);
        if (!gig) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Gig not found' });
        }
        return gig;
      }),
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
          z.object({
            kind: z.literal('band-for-gig-slot'),
            gigId: z.number().int().positive(),
            setLength: z.number().int().positive().optional(),
            feeOffered: z.number().int().nonnegative().optional(),
          }),
        ]),
      )
      .mutation(async ({ ctx, input }) => {
        const userId = Number(ctx.user.id);

        if (input.kind === 'musician-for-band') {
          const allowed = await isMemberOfBand(userId, input.bandId);
          if (!allowed) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'You must be a member of this band to post this request',
            });
          }
          return createRequest(input, userId);
        }

        // band-for-gig-slot: only the gig organiser may post this kind of
        // request. We look up the gig, verify ownership, then count the open
        // slots to snapshot `slot_count` at request-creation time.
        const gig = await getGigById(input.gigId);
        if (!gig) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Gig not found' });
        }
        if (gig.organiserUserId !== userId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Only the gig organiser may post a band-for-gig-slot request',
          });
        }
        const openSlotCount = await countOpenSlots(input.gigId);
        if (openSlotCount === 0) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'This gig has no open slots to fill',
          });
        }
        return createRequest(
          {
            kind: 'band-for-gig-slot',
            gigId: input.gigId,
            setLength: input.setLength,
            feeOffered: input.feeOffered,
            openSlotCount,
          },
          userId,
        );
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
          // Discriminated union on `kind` — mirrors requests.create.
          details: z
            .discriminatedUnion('kind', [
              z.object({
                kind: z.literal('musician-for-band'),
                notes: z.string().optional(),
              }),
              z.object({
                kind: z.literal('band-for-gig-slot'),
                bandId: z.number().int().positive(),
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
        // `band-for-gig-slot` EoIs must carry a `bandId` so the accept path
        // knows which band to slot in. Reject up-front if missing or mismatched.
        if (req.kind === 'band-for-gig-slot') {
          if (!input.details || input.details.kind !== 'band-for-gig-slot') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message:
                'A band-for-gig-slot expression of interest must include details.bandId',
            });
          }
          const allowed = await isMemberOfBand(userId, input.details.bandId);
          if (!allowed) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message:
                'You must be a member of the band to express interest on its behalf',
            });
          }
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
        if (result.kind === 'invalid_eoi_details') {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'This expression of interest is missing the band needed to fill a slot',
          });
        }
        if (result.kind === 'no_open_slot') {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'All slots on this gig are already filled',
          });
        }
        return result.outcome;
      }),
  }),
});

export type AppRouter = typeof appRouter;
