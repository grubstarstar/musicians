import { describe, expect, it } from 'vitest';
import { resolvePostCreateRoute } from './resolvePostCreateRoute';

describe('resolvePostCreateRoute', () => {
  it('appends ?new=1 for memberMode=band on a band entity', () => {
    expect(
      resolvePostCreateRoute({ entityType: 'band', id: 17, memberMode: 'band' }),
    ).toBe('/band/17?new=1');
  });

  it('appends ?new=1 for memberMode=promoterGroup on a promoter-group entity', () => {
    expect(
      resolvePostCreateRoute({
        entityType: 'promoterGroup',
        id: 9,
        memberMode: 'promoterGroup',
      }),
    ).toBe('/promoter-group/9?new=1');
  });

  it('omits ?new=1 for solo bands so the Add members CTA is not shown', () => {
    expect(
      resolvePostCreateRoute({ entityType: 'band', id: 3, memberMode: 'solo' }),
    ).toBe('/band/3');
  });

  it('omits ?new=1 for solo promoters', () => {
    expect(
      resolvePostCreateRoute({
        entityType: 'promoterGroup',
        id: 5,
        memberMode: 'solo',
      }),
    ).toBe('/promoter-group/5');
  });
});
