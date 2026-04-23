import { TRPCError, initTRPC } from '@trpc/server';
import type { Context } from './context.js';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { user: ctx.user } });
});

// Exposed so integration tests can drive the router with a synthetic
// `Context` object instead of going through HTTP + JWT. Using the factory
// keeps the caller bound to this single `t` instance.
export const createCallerFactory = t.createCallerFactory;
