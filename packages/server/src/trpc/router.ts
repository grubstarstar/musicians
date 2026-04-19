import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getBandProfile, listBands, listMyBands } from '../bands/queries.js';
import { db } from '../db.js';
import {
  countOpenSlots,
  createGig,
  getGigById,
  hasPromoterRole,
  listGigsByOrganiser,
} from '../gigs/queries.js';
import { getUpcomingRehearsalsForBand } from '../rehearsals/queries.js';
import {
  createEoi,
  getRequestById,
  hasPendingEoiFromUser,
  listMyEois,
  respondToEoi,
} from '../requests/eoiQueries.js';
import {
  createRequest,
  getRequestForDetail,
  isMemberOfBand,
  listMatchesForUser,
  listMyRequests,
  listOpenRequests,
} from '../requests/queries.js';
import { requestKindEnum, venues, type EoiDetails } from '../schema.js';
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
    // Caller-scoped listing for Home's "Your bands" row (MUS-63). Mirrors the
    // naming of `requests.listMine` (MUS-55). `list` stays in place because
    // the Post Request picker and web discovery still want the full list.
    listMine: protectedProcedure.query(({ ctx }) => {
      const userId = Number(ctx.user.id);
      return listMyBands(userId);
    }),
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
  // Venues (MUS-58). Minimal list endpoint so the mobile
  // `promoter-for-venue-night` form can let the caller pick a venue. No
  // authorisation gating beyond authentication for this slice — the
  // "venue rep" concept is out of scope per the ticket.
  venues: router({
    list: protectedProcedure.query(async () => {
      const rows = await db
        .select({
          id: venues.id,
          name: venues.name,
          address: venues.address,
        })
        .from(venues)
        .orderBy(venues.name);
      return rows;
    }),
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
        const isPromoter = await hasPromoterRole(userId);
        if (!isPromoter) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Only promoters can create gigs',
          });
        }
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
          // `gig-for-band` (MUS-57): band-side request; no anchor object.
          // `targetDate` is a `yyyy-mm-dd` string (single date for this slice).
          z.object({
            kind: z.literal('gig-for-band'),
            bandId: z.number().int().positive(),
            targetDate: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/, 'targetDate must be yyyy-mm-dd'),
            area: z.string().min(1).optional(),
            feeAsked: z.number().int().nonnegative().optional(),
          }),
          // `night-at-venue` (MUS-58): promoter-side request; no anchor
          // object. Acceptance creates a draft gig from the EoI payload.
          z.object({
            kind: z.literal('night-at-venue'),
            concept: z.string().min(1),
            possibleDates: z
              .array(
                z
                  .string()
                  .regex(/^\d{4}-\d{2}-\d{2}$/, 'possibleDates must be yyyy-mm-dd'),
              )
              .min(1, 'At least one possible date is required'),
          }),
          // `promoter-for-venue-night` (MUS-58): venue-side request; no anchor
          // object. Acceptance creates a draft gig from the request payload.
          z.object({
            kind: z.literal('promoter-for-venue-night'),
            venueId: z.number().int().positive(),
            proposedDate: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/, 'proposedDate must be yyyy-mm-dd'),
            concept: z.string().min(1).optional(),
          }),
          // `band-for-musician` (MUS-58): musician-side request; no anchor
          // object. Acceptance adds the musician to the EoI-supplied band.
          z.object({
            kind: z.literal('band-for-musician'),
            instrument: z.string().min(1),
            availability: z.string().min(1).optional(),
            demosUrl: z.string().min(1).optional(),
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

        if (input.kind === 'band-for-gig-slot') {
          // band-for-gig-slot: only the gig organiser may post this kind of
          // request. We look up the gig, verify ownership, then count the
          // open slots to snapshot `slot_count` at request-creation time.
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
        }

        if (input.kind === 'gig-for-band') {
          // gig-for-band: band must consent — enforce that the caller is a
          // member of the band on whose behalf they're posting.
          const allowed = await isMemberOfBand(userId, input.bandId);
          if (!allowed) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'You must be a member of this band to post this request',
            });
          }
          return createRequest(input, userId);
        }

        if (input.kind === 'night-at-venue') {
          // night-at-venue: no gating beyond authentication for this slice —
          // anyone can broadcast a concept. Authorisation for who counts as a
          // "promoter" is out of scope until the roles work from MUS-6 is
          // used to gate this kind.
          return createRequest(input, userId);
        }

        if (input.kind === 'promoter-for-venue-night') {
          // promoter-for-venue-night: no venue-rep gating for this slice per
          // the ticket (any venue row is acceptable). We do validate the
          // venue actually exists to avoid rows pointing at nothing.
          const [venue] = await db
            .select({ id: venues.id })
            .from(venues)
            .where(eq(venues.id, input.venueId))
            .limit(1);
          if (!venue) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Venue not found' });
          }
          return createRequest(input, userId);
        }

        // band-for-musician: no gating beyond authentication. Free-text
        // instrument for this slice — MUS-68 swaps to the taxonomy.
        return createRequest(input, userId);
      }),
    list: protectedProcedure
      .input(z.object({ kind: z.enum(requestKindEnum.enumValues).optional() }))
      .query(({ ctx, input }) => {
        // Exclude the caller's own requests so the Opportunities tab only
        // shows rows they could actually act on (MUS-61).
        const excludeUserId = Number(ctx.user.id);
        return listOpenRequests({ kind: input.kind, excludeUserId });
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const req = await getRequestForDetail(input.id);
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
    // Target-side list for the Applied tab (MUS-64). Returns the caller's own
    // EoIs, newest first, each with the parent request + anchor pre-joined so
    // the mobile list renders without further round-trips.
    listMine: protectedProcedure.query(({ ctx }) => {
      const userId = Number(ctx.user.id);
      return listMyEois(userId);
    }),
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
              // `gig-for-band` EoI (MUS-57): promoter offers one of their
              // gigs to a band. Optional link to a sibling band-for-gig-slot
              // request when it's the same engagement two ways.
              z.object({
                kind: z.literal('gig-for-band'),
                gigId: z.number().int().positive(),
                bandForGigSlotRequestId: z.number().int().positive().optional(),
                proposedFee: z.number().int().nonnegative().optional(),
              }),
              // `night-at-venue` EoI (MUS-58): venue rep proposes a venue +
              // specific date from the promoter's possibleDates list.
              z.object({
                kind: z.literal('night-at-venue'),
                venueId: z.number().int().positive(),
                proposedDate: z
                  .string()
                  .regex(/^\d{4}-\d{2}-\d{2}$/, 'proposedDate must be yyyy-mm-dd'),
                concept: z.string().min(1).optional(),
              }),
              // `promoter-for-venue-night` EoI (MUS-58): promoter offers to
              // run the venue's proposed night. Only the concept is
              // optionally supplied — venue + date come from the request.
              z.object({
                kind: z.literal('promoter-for-venue-night'),
                concept: z.string().min(1).optional(),
              }),
              // `band-for-musician` EoI (MUS-58): band member offers the
              // musician one of their bands. `instrumentRole` defaults to
              // the request's instrument when omitted.
              z.object({
                kind: z.literal('band-for-musician'),
                bandId: z.number().int().positive(),
                instrumentRole: z.string().min(1).optional(),
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
        // `gig-for-band` EoIs must carry a `gigId` pointing to a gig the
        // caller organises and which has at least one open slot.
        if (req.kind === 'gig-for-band') {
          if (!input.details || input.details.kind !== 'gig-for-band') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message:
                'A gig-for-band expression of interest must include details.gigId',
            });
          }
          const gig = await getGigById(input.details.gigId);
          if (!gig) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Gig not found' });
          }
          if (gig.organiserUserId !== userId) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'You may only offer gigs that you organise',
            });
          }
          const openSlotCount = await countOpenSlots(input.details.gigId);
          if (openSlotCount === 0) {
            throw new TRPCError({
              code: 'PRECONDITION_FAILED',
              message: 'This gig has no open slots to offer',
            });
          }
        }
        // `night-at-venue` EoIs (MUS-58): venue rep proposes a venue + date
        // from the promoter's possibleDates list. Per the ticket, any venue
        // row is acceptable for this slice (venue-rep gating is out of scope).
        // We still verify the venue exists and the date is one that was
        // offered — tampering between create and accept would otherwise be
        // possible.
        if (req.kind === 'night-at-venue') {
          if (!input.details || input.details.kind !== 'night-at-venue') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message:
                'A night-at-venue expression of interest must include details.venueId and details.proposedDate',
            });
          }
          const [venue] = await db
            .select({ id: venues.id })
            .from(venues)
            .where(eq(venues.id, input.details.venueId))
            .limit(1);
          if (!venue) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Venue not found' });
          }
          if (
            req.details.kind === 'night-at-venue' &&
            !req.details.possibleDates.includes(input.details.proposedDate)
          ) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message:
                'Proposed date must be one of the dates the promoter offered',
            });
          }
        }
        // `promoter-for-venue-night` EoIs (MUS-58): nothing to validate
        // beyond the base checks — venue + date sit on the request side.
        if (req.kind === 'promoter-for-venue-night') {
          if (
            !input.details ||
            input.details.kind !== 'promoter-for-venue-night'
          ) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message:
                'A promoter-for-venue-night expression of interest must carry the matching kind',
            });
          }
        }
        // `band-for-musician` EoIs (MUS-58): band member offers the musician
        // a specific band they're in. Reuse isMemberOfBand to enforce consent.
        if (req.kind === 'band-for-musician') {
          if (!input.details || input.details.kind !== 'band-for-musician') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message:
                'A band-for-musician expression of interest must include details.bandId',
            });
          }
          const allowed = await isMemberOfBand(userId, input.details.bandId);
          if (!allowed) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message:
                'You must be a member of the band to offer it on its behalf',
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
        if (result.kind === 'date_not_offered') {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Proposed date is no longer one of the offered dates',
          });
        }
        return result.outcome;
      }),
  }),
  // Matches (MUS-57): on-demand counterpart discovery. Surface-level view
  // over the caller's open requests vs other users' open counterpart
  // requests filtered through `matchesGigRequest`.
  matches: router({
    listForUser: protectedProcedure.query(({ ctx }) => {
      const userId = Number(ctx.user.id);
      return listMatchesForUser(userId);
    }),
  }),
});

export type AppRouter = typeof appRouter;
