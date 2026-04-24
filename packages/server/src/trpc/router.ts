import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  createBandWithCreator,
  getBandProfile,
  listBands,
  listMyBands,
} from '../bands/queries.js';
import { db } from '../db.js';
import {
  listInstruments,
  searchInstruments,
} from '../instruments/queries.js';
import {
  countOpenSlots,
  createGig,
  getGigById,
  getGigSlotForSeed,
  hasPromoterRole,
  listGigsByOrganiser,
} from '../gigs/queries.js';
import {
  getMusicianProfile,
  upsertMusicianProfile,
} from '../musicianProfiles/queries.js';
import {
  addUserRole,
  getResumeStep,
  ONBOARDING_ROLES,
} from '../onboarding/queries.js';
import { getPromoterGroupDetail } from '../promoterGroups/getPromoterGroupDetail.js';
import {
  createPromoterGroupWithCreator,
  isMemberOfPromoterGroup,
  listMyPromoterGroups,
} from '../promoterGroups/queries.js';
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
import {
  bandGenres,
  bandMembers,
  bands,
  promoterGroups,
  promotersPromoterGroups,
  requestKindEnum,
  requests,
  userRoles,
  venues,
  type EoiDetails,
} from '../schema.js';
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
    // MUS-92: name-first create from the onboarding wizard. The caller is
    // recorded as both `created_by_user_id` (used by the profile screen to
    // gate the "Add members" CTA) and the first `band_members` row. The
    // mutation is the same for `band` and `solo` modes — the membership
    // shape is identical (single member to start) and the *only* difference
    // is whether the mobile post-create router appends `?new=1` to the
    // resulting profile URL. We echo `memberMode` back so the client can
    // make that routing decision in one round trip.
    create: protectedProcedure
      .input(
        z.object({
          name: z
            .string()
            .trim()
            .min(1, 'Name is required'),
          memberMode: z.enum(['band', 'solo']),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const userId = Number(ctx.user.id);
        const result = await createBandWithCreator({ name: input.name }, userId);
        // The helper always returns memberMode='band'; rewrite to the
        // caller-supplied mode so the mobile router can branch on it.
        return { id: result.id, memberMode: input.memberMode };
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
  // Promoter groups (MUS-82). Read-only surface — returns the caller's
  // promoter groups with each group's linked venues. Resolution goes
  // user_roles (role = 'promoter') → promoters_promoter_groups →
  // promoter_groups → promoter_groups_venues → venues. A user with no
  // promoter role gets `[]` (not an error). No create/update/delete
  // procedures in this slice.
  promoterGroups: router({
    listMine: protectedProcedure.query(({ ctx }) => {
      const userId = Number(ctx.user.id);
      return listMyPromoterGroups(userId);
    }),
    // Detail view for a single promoter group (MUS-100). Returns the group's
    // venues + members. Non-members get NOT_FOUND — same shape as `bands.getById`
    // and the MUS-58 / MUS-70 pattern, so membership can't be fingerprinted
    // from a distinct FORBIDDEN vs NOT_FOUND response.
    get: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const userId = Number(ctx.user.id);
        const detail = await getPromoterGroupDetail(userId, input.id);
        if (!detail) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Promoter group not found',
          });
        }
        return detail;
      }),
    // MUS-92: name-first create from the onboarding wizard's "Create a
    // promoter group" / "I'm a solo promoter" branches. The mutation grants
    // the caller the `promoter` role if they don't have one, inserts the
    // group with `created_by_user_id` set, and links the caller as the
    // first member through `promoters_promoter_groups`. `memberMode` is
    // restricted to `'promoterGroup' | 'solo'` here — `'band'` is rejected
    // up front so the discriminated mode space stays well-typed across
    // callers and screen branches.
    create: protectedProcedure
      .input(
        z.object({
          name: z
            .string()
            .trim()
            .min(1, 'Name is required'),
          memberMode: z.enum(['promoterGroup', 'solo']),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const userId = Number(ctx.user.id);
        const result = await createPromoterGroupWithCreator(
          { name: input.name },
          userId,
        );
        return { id: result.id, memberMode: input.memberMode };
      }),
  }),
  // Onboarding (MUS-89). Thin surface for the first-run wizard — currently
  // just the role-picker step. `setRole` idempotently appends a role to
  // `users.roles` (MUS-86 column) and returns the resulting array so the
  // client can update local state without a follow-up fetch. Kept as a
  // `z.enum` input because every allowed role has the same shape today; if a
  // future role needs structured payload (e.g. `engineer` with a discipline
  // sub-type), swap to a discriminated union on `role` to match the
  // `requests.create` / `expressionsOfInterest.create` convention.
  onboarding: router({
    setRole: protectedProcedure
      .input(z.object({ role: z.enum(ONBOARDING_ROLES) }))
      .mutation(({ ctx, input }) => {
        const userId = Number(ctx.user.id);
        return addUserRole(userId, input.role);
      }),
    // MUS-94: server-derived resume step. The mobile app calls this from the
    // auth gate on every launch/login and after each onboarding mutation to
    // decide whether to show the wizard (and which step) or the home screen.
    // Rules live in `resolveResumeStep`; DB evidence gathered in
    // `getOnboardingEvidence`. Returns `'role-picker' | 'musician' | 'promoter' | 'complete'`.
    getResumeStep: protectedProcedure.query(({ ctx }) => {
      const userId = Number(ctx.user.id);
      return getResumeStep(userId);
    }),
  }),
  // MUS-95: post-onboarding user mutations. `addRole` is the settings-side
  // entry point for appending a second role to `users.roles` (e.g. a promoter
  // adding `musician` later). Delegates to the same idempotent `addUserRole`
  // helper that backs `onboarding.setRole` — kept as a sibling router under
  // `users` rather than overloading `onboarding` because semantically this is
  // a settings action, not part of the first-run wizard.
  //
  // Idempotency: reposting the same role is a no-op and returns the current
  // `roles` array. The client can safely retry on a network blip without
  // risking duplicate entries. (The underlying helper also guards against
  // concurrent appends via a Postgres `array_position IS NULL` predicate.)
  users: router({
    addRole: protectedProcedure
      .input(z.object({ role: z.enum(ONBOARDING_ROLES) }))
      .mutation(({ ctx, input }) => {
        const userId = Number(ctx.user.id);
        return addUserRole(userId, input.role);
      }),
  }),
  // Musician profiles (MUS-85). Per-user musician data kept in `musician_profiles`
  // as a 1:1 companion to `users`. `get` is public so future discovery UIs can
  // look up anyone's profile by id; `upsertMine` is strictly caller-keyed —
  // there is no `userId` on the input so one user cannot overwrite another's
  // row (see CLAUDE.md tRPC conventions: always coerce `ctx.user.id` once at
  // the procedure boundary).
  musicianProfiles: router({
    get: publicProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .query(({ input }) => getMusicianProfile(input.userId)),
    upsertMine: protectedProcedure
      .input(
        z.object({
          instruments: z.array(z.string().min(1)),
          experienceYears: z.number().int().nonnegative().nullable(),
          location: z.string().min(1).nullable(),
          bio: z.string().min(1).nullable(),
          availableForSessionWork: z.boolean(),
        }),
      )
      .mutation(({ ctx, input }) => {
        const userId = Number(ctx.user.id);
        return upsertMusicianProfile(userId, input);
      }),
  }),
  // Instruments taxonomy (MUS-68). Read-only surface for the Post Request
  // autocomplete and future filtering UIs.
  //   - `list` returns the full 150–200 row taxonomy (one query, no pagination).
  //   - `search(query)` feeds the debounced autocomplete: prefix matches
  //     first, then contains matches, sorted by category then name.
  // Both are `protectedProcedure` — the autocomplete is only reachable from
  // authenticated screens today, and gating consistently is simpler than
  // making half the lookup surface public.
  instruments: router({
    list: protectedProcedure.query(() => listInstruments()),
    search: protectedProcedure
      .input(z.object({ query: z.string() }))
      .query(({ input }) => searchInstruments(input.query)),
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
    // MUS-77: slot-anchored seed lookup for the post-request form. Returns
    // the slot's owning gig id + optional genre so the mobile form can
    // pre-fill `band-for-gig-slot` state from a single URL param.
    //
    // Ownership gate: we collapse "slot missing" and "caller doesn't own the
    // gig" into a single NOT_FOUND so a non-organiser pasting someone else's
    // slotId can't fingerprint which slots exist. This matches the
    // membership-gate pattern used by `bands.getById` / `promoterGroups.get`.
    getSlotById: protectedProcedure
      .input(z.object({ slotId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const userId = Number(ctx.user.id);
        const slot = await getGigSlotForSeed(input.slotId);
        if (!slot || slot.organiserUserId !== userId) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Slot not found',
          });
        }
        // Explicit projection — strip `organiserUserId` from the response so
        // the gate isn't leaked to the client, only the fields the form
        // actually needs.
        return {
          slotId: slot.slotId,
          gigId: slot.gigId,
          genre: slot.genre,
        };
      }),
  }),
  requests: router({
    create: protectedProcedure
      .input(
        z.discriminatedUnion('kind', [
          z.object({
            kind: z.literal('musician-for-band'),
            bandId: z.number().int().positive(),
            // MUS-68: instrumentId resolved against the controlled `instruments`
            // taxonomy (the autocomplete picks this). Free-text fallbacks are
            // mapped to the canonical "Other" row client-side before submit.
            instrumentId: z.number().int().positive(),
            style: z.string().optional(),
            rehearsalCommitment: z.string().optional(),
          }),
          z.object({
            kind: z.literal('band-for-gig-slot'),
            gigId: z.number().int().positive(),
            setLength: z.number().int().positive().optional(),
            feeOffered: z.number().int().nonnegative().optional(),
            // MUS-103: optional genre requirement. When set, the EoI hard-gate
            // at `expressionsOfInterest.create` rejects applying bands whose
            // `band_genres` don't include this id. Null/unset → any band.
            genreId: z.number().int().positive().optional(),
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
            // MUS-68: see musician-for-band above.
            instrumentId: z.number().int().positive(),
            availability: z.string().min(1).optional(),
            demosUrl: z.string().min(1).optional(),
          }),
          // `band_join` (MUS-87): requester asks to join a specific band.
          // Acceptance is authorised for any existing member of the target
          // band and inserts the requester into `band_members`.
          z.object({
            kind: z.literal('band_join'),
            bandId: z.number().int().positive(),
          }),
          // `promoter_group_join` (MUS-88): mirror of band_join for promoter
          // groups. Acceptance is authorised for any existing member of the
          // target group and inserts the requester into
          // `promoters_promoter_groups`.
          z.object({
            kind: z.literal('promoter_group_join'),
            promoterGroupId: z.number().int().positive(),
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
          if (gig.organiser.id !== userId) {
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
              genreId: input.genreId,
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

        if (input.kind === 'band_join') {
          // band_join (MUS-87): requester asks to join a specific band. We
          // verify the band exists so the row doesn't point at nothing, and
          // reject up-front if the requester is already a member — that's a
          // no-op request and worth a clear error rather than silently
          // closing on accept.
          const [band] = await db
            .select({ id: bands.id })
            .from(bands)
            .where(eq(bands.id, input.bandId))
            .limit(1);
          if (!band) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Band not found' });
          }
          const alreadyMember = await isMemberOfBand(userId, input.bandId);
          if (alreadyMember) {
            throw new TRPCError({
              code: 'PRECONDITION_FAILED',
              message: 'You are already a member of this band',
            });
          }
          return createRequest(input, userId);
        }

        if (input.kind === 'promoter_group_join') {
          // promoter_group_join (MUS-88): mirror of band_join for promoter
          // groups. Verify the group exists and reject up-front if the
          // requester is already a member so accepting never silently no-ops.
          const [group] = await db
            .select({ id: promoterGroups.id })
            .from(promoterGroups)
            .where(eq(promoterGroups.id, input.promoterGroupId))
            .limit(1);
          if (!group) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Promoter group not found',
            });
          }
          const alreadyMember = await isMemberOfPromoterGroup(
            userId,
            input.promoterGroupId,
          );
          if (alreadyMember) {
            throw new TRPCError({
              code: 'PRECONDITION_FAILED',
              message: 'You are already a member of this promoter group',
            });
          }
          return createRequest(input, userId);
        }

        // band-for-musician: no gating beyond authentication. Free-text
        // instrument for this slice — MUS-68 swaps to the taxonomy.
        return createRequest(input, userId);
      }),
    // band_join response (MUS-87). Any existing member of the target band can
    // accept or reject. Acceptance inserts the requester into `band_members`
    // (idempotent via composite PK) and marks the request closed. Rejection
    // closes the request without touching membership.
    //
    // Kept as a kind-specific procedure rather than overloading
    // `expressionsOfInterest.respond` because the authority model differs:
    // EoI respond gates on `req.source_user_id === callerUserId`, but the
    // source of a `band_join` is the REQUESTER — we want any member of the
    // target band to decide instead.
    respondToBandJoin: protectedProcedure
      .input(
        z.object({
          requestId: z.number().int().positive(),
          decision: z.enum(['accepted', 'rejected']),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const userId = Number(ctx.user.id);
        return db.transaction(async (tx) => {
          const [req] = await tx
            .select({
              id: requests.id,
              kind: requests.kind,
              status: requests.status,
              sourceUserId: requests.source_user_id,
              anchorBandId: requests.anchor_band_id,
              details: requests.details,
            })
            .from(requests)
            .where(eq(requests.id, input.requestId))
            .limit(1);
          if (!req) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
          }
          if (req.kind !== 'band_join' || req.details.kind !== 'band_join') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'This request is not a band_join request',
            });
          }
          if (req.status !== 'open') {
            throw new TRPCError({
              code: 'PRECONDITION_FAILED',
              message: 'Request is not open',
            });
          }
          const targetBandId = req.anchorBandId ?? req.details.bandId;
          // Any existing member of the target band is authorised to decide.
          const [callerMembership] = await tx
            .select({ user_id: bandMembers.user_id })
            .from(bandMembers)
            .where(
              and(
                eq(bandMembers.band_id, targetBandId),
                eq(bandMembers.user_id, userId),
              ),
            )
            .limit(1);
          if (!callerMembership) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message:
                'Only an existing member of the target band can respond to a band_join request',
            });
          }

          const now = new Date();

          if (input.decision === 'accepted') {
            // Idempotent insert — composite PK collides on repeat and
            // `onConflictDoNothing` swallows that cleanly. Mirrors the
            // `musician-for-band` / `band-for-musician` acceptance pattern.
            await tx
              .insert(bandMembers)
              .values({ band_id: targetBandId, user_id: req.sourceUserId })
              .onConflictDoNothing();
            await tx
              .update(requests)
              .set({
                status: 'closed',
                slots_filled: 1,
                updated_at: now,
              })
              .where(eq(requests.id, req.id));
            return { requestId: req.id, status: 'closed' as const };
          }

          // Rejected: close the request without touching membership.
          await tx
            .update(requests)
            .set({ status: 'closed', updated_at: now })
            .where(eq(requests.id, req.id));
          return { requestId: req.id, status: 'closed' as const };
        });
      }),
    // promoter_group_join response (MUS-88). Mirror of `respondToBandJoin` for
    // promoter groups: any existing member of the target group can accept or
    // reject. Acceptance inserts the requester into the group (creating a
    // `user_roles` row with role='promoter' first if they don't already have
    // one, since the join table FKs a `user_roles` row rather than the user
    // directly) and marks the request closed. Rejection closes without
    // touching membership.
    //
    // Kept as a kind-specific procedure for the same reason as
    // `respondToBandJoin` — EoI's authority model gates on source_user_id but
    // we want any existing group member to decide, not just the requester.
    respondToPromoterGroupJoin: protectedProcedure
      .input(
        z.object({
          requestId: z.number().int().positive(),
          decision: z.enum(['accepted', 'rejected']),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const userId = Number(ctx.user.id);
        return db.transaction(async (tx) => {
          const [req] = await tx
            .select({
              id: requests.id,
              kind: requests.kind,
              status: requests.status,
              sourceUserId: requests.source_user_id,
              details: requests.details,
            })
            .from(requests)
            .where(eq(requests.id, input.requestId))
            .limit(1);
          if (!req) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
          }
          if (
            req.kind !== 'promoter_group_join' ||
            req.details.kind !== 'promoter_group_join'
          ) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'This request is not a promoter_group_join request',
            });
          }
          if (req.status !== 'open') {
            throw new TRPCError({
              code: 'PRECONDITION_FAILED',
              message: 'Request is not open',
            });
          }
          const targetGroupId = req.details.promoterGroupId;
          // Any existing member of the target group is authorised to decide.
          // Resolve membership the same way `isMemberOfPromoterGroup` does:
          // user_roles (role='promoter') → promoters_promoter_groups.
          const [callerMembership] = await tx
            .select({ id: promotersPromoterGroups.id })
            .from(promotersPromoterGroups)
            .innerJoin(
              userRoles,
              eq(userRoles.id, promotersPromoterGroups.user_role_id),
            )
            .where(
              and(
                eq(promotersPromoterGroups.promoter_group_id, targetGroupId),
                eq(userRoles.user_id, userId),
                eq(userRoles.role, 'promoter'),
              ),
            )
            .limit(1);
          if (!callerMembership) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message:
                'Only an existing member of the target promoter group can respond to a promoter_group_join request',
            });
          }

          const now = new Date();

          if (input.decision === 'accepted') {
            // Acceptance path: the requester needs both a `user_roles` row
            // with role='promoter' AND a `promoters_promoter_groups` row
            // linking that role to the group. The onboarding flow for the
            // requester may or may not have already created the promoter
            // role row (MUS-86 carries roles on `users` but MUS-6's
            // `user_roles` remains the FK target for group membership), so
            // we upsert both defensively.
            //
            // `user_roles` has a unique index on (user_id, role) —
            // `onConflictDoNothing` makes it idempotent. We then select the
            // row (returning's not guaranteed to produce a row when nothing
            // was inserted) to get the role id to insert into the join
            // table.
            await tx
              .insert(userRoles)
              .values({ user_id: req.sourceUserId, role: 'promoter' })
              .onConflictDoNothing();
            const [requesterRole] = await tx
              .select({ id: userRoles.id })
              .from(userRoles)
              .where(
                and(
                  eq(userRoles.user_id, req.sourceUserId),
                  eq(userRoles.role, 'promoter'),
                ),
              )
              .limit(1);
            if (!requesterRole) {
              // Belt-and-braces: the upsert path above should always leave a
              // row. Fail loud if the invariant ever breaks rather than
              // silently closing the request without creating the membership.
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to resolve requester promoter role',
              });
            }
            // Idempotent insert via the unique index on (user_role_id,
            // promoter_group_id). Mirrors the band_members `onConflictDoNothing`
            // pattern so a concurrent insert doesn't crash the accept.
            await tx
              .insert(promotersPromoterGroups)
              .values({
                user_role_id: requesterRole.id,
                promoter_group_id: targetGroupId,
              })
              .onConflictDoNothing();
            await tx
              .update(requests)
              .set({
                status: 'closed',
                slots_filled: 1,
                updated_at: now,
              })
              .where(eq(requests.id, req.id));
            return { requestId: req.id, status: 'closed' as const };
          }

          // Rejected: close the request without touching membership.
          await tx
            .update(requests)
            .set({ status: 'closed', updated_at: now })
            .where(eq(requests.id, req.id));
          return { requestId: req.id, status: 'closed' as const };
        });
      }),
    // Cancel a request the caller authored (MUS-87). Usable for any kind but
    // landed in this ticket because the band_join accept-path tests need a
    // cancel path to exercise. Cancellation does NOT fire any membership or
    // slot side-effects — it's a source-side withdrawal only.
    cancel: protectedProcedure
      .input(z.object({ requestId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const userId = Number(ctx.user.id);
        return db.transaction(async (tx) => {
          const [req] = await tx
            .select({
              id: requests.id,
              status: requests.status,
              sourceUserId: requests.source_user_id,
            })
            .from(requests)
            .where(eq(requests.id, input.requestId))
            .limit(1);
          if (!req) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
          }
          if (req.sourceUserId !== userId) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Only the request author can cancel it',
            });
          }
          if (req.status !== 'open') {
            throw new TRPCError({
              code: 'PRECONDITION_FAILED',
              message: 'Request is not open',
            });
          }
          await tx
            .update(requests)
            .set({ status: 'cancelled', updated_at: new Date() })
            .where(eq(requests.id, req.id));
          return { requestId: req.id, status: 'cancelled' as const };
        });
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
          // MUS-103: genre hard-gate. When the request snapshotted a
          // `details.genreId` at creation time, the applying band's
          // `band_genres` rows MUST include that id. A null/unset genreId
          // means the slot is open to any band (back-compat with pre-MUS-103
          // requests and with slots created without a genre requirement).
          const requestDetails = req.details;
          if (
            requestDetails.kind === 'band-for-gig-slot' &&
            typeof requestDetails.genreId === 'number'
          ) {
            const [match] = await db
              .select({ band_id: bandGenres.band_id })
              .from(bandGenres)
              .where(
                and(
                  eq(bandGenres.band_id, input.details.bandId),
                  eq(bandGenres.genre_id, requestDetails.genreId),
                ),
              )
              .limit(1);
            if (!match) {
              throw new TRPCError({
                code: 'FORBIDDEN',
                message: 'Band genre does not match gig slot requirement.',
              });
            }
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
          if (gig.organiser.id !== userId) {
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
