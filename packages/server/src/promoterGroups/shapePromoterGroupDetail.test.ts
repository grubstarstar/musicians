import { describe, expect, it } from 'vitest';
import {
  shapePromoterGroupDetail,
  type MemberRow,
  type PromoterGroupBaseRow,
  type VenueRow,
} from './shapePromoterGroupDetail.js';

describe('shapePromoterGroupDetail', () => {
  const group: PromoterGroupBaseRow = {
    id: 1,
    name: 'Alpha Presents',
    createdByUserId: null,
  };

  it('returns the group shape with empty arrays when there are no venues or members', () => {
    expect(shapePromoterGroupDetail(group, [], [])).toEqual({
      id: 1,
      name: 'Alpha Presents',
      createdByUserId: null,
      venues: [],
      members: [],
    });
  });

  it('carries createdByUserId through unchanged when set', () => {
    const groupWithCreator: PromoterGroupBaseRow = {
      id: 2,
      name: 'Bravo Promotions',
      createdByUserId: 42,
    };
    const result = shapePromoterGroupDetail(groupWithCreator, [], []);
    expect(result.createdByUserId).toBe(42);
  });

  it('projects venues to { id, name, address } and preserves caller order', () => {
    const venues: VenueRow[] = [
      { id: 20, name: 'Aurora Hall', address: '1 A St' },
      { id: 10, name: 'Beta Club', address: '2 B St' },
    ];
    const result = shapePromoterGroupDetail(group, venues, []);
    expect(result.venues).toEqual([
      { id: 20, name: 'Aurora Hall', address: '1 A St' },
      { id: 10, name: 'Beta Club', address: '2 B St' },
    ]);
  });

  it('projects members to { userId, username, firstName, lastName } and preserves caller order', () => {
    const members: MemberRow[] = [
      { userId: 5, username: 'zed', firstName: null, lastName: null },
      { userId: 3, username: 'alice', firstName: 'Alice', lastName: 'Smith' },
    ];
    const result = shapePromoterGroupDetail(group, [], members);
    expect(result.members).toEqual([
      { userId: 5, username: 'zed', firstName: null, lastName: null },
      { userId: 3, username: 'alice', firstName: 'Alice', lastName: 'Smith' },
    ]);
  });

  it('carries through nullable firstName / lastName without coercion', () => {
    const members: MemberRow[] = [
      { userId: 7, username: 'promoter1', firstName: null, lastName: null },
    ];
    const result = shapePromoterGroupDetail(group, [], members);
    expect(result.members[0]).toEqual({
      userId: 7,
      username: 'promoter1',
      firstName: null,
      lastName: null,
    });
  });
});
