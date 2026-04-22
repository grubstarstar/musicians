import { describe, expect, it } from 'vitest';
import {
  groupVenuesByPromoterGroup,
  type PromoterGroupBaseRow,
  type VenueForGroupRow,
} from './groupVenuesByPromoterGroup.js';

describe('groupVenuesByPromoterGroup', () => {
  it('returns an empty array when there are no groups', () => {
    expect(groupVenuesByPromoterGroup([], [])).toEqual([]);
  });

  it('preserves caller-supplied group order and pairs matching venues', () => {
    const groups: PromoterGroupBaseRow[] = [
      { id: 1, name: 'Alpha Presents' },
      { id: 2, name: 'Beta Concerts' },
    ];
    const venues: VenueForGroupRow[] = [
      { promoterGroupId: 1, id: 10, name: 'Aurora Hall', address: '1 A St' },
      { promoterGroupId: 2, id: 20, name: 'Bravo Club', address: '2 B St' },
    ];

    const result = groupVenuesByPromoterGroup(groups, venues);

    expect(result).toEqual([
      {
        id: 1,
        name: 'Alpha Presents',
        venues: [{ id: 10, name: 'Aurora Hall', address: '1 A St' }],
      },
      {
        id: 2,
        name: 'Beta Concerts',
        venues: [{ id: 20, name: 'Bravo Club', address: '2 B St' }],
      },
    ]);
  });

  it('returns an empty venues array when a group has no linked venues', () => {
    const groups: PromoterGroupBaseRow[] = [
      { id: 1, name: 'Alpha Presents' },
      { id: 2, name: 'Beta Concerts' },
    ];
    const venues: VenueForGroupRow[] = [
      { promoterGroupId: 2, id: 20, name: 'Bravo Club', address: '2 B St' },
    ];

    const result = groupVenuesByPromoterGroup(groups, venues);

    expect(result[0]).toEqual({ id: 1, name: 'Alpha Presents', venues: [] });
    expect(result[1].venues).toHaveLength(1);
  });

  it('sorts venues inside each group by name ascending', () => {
    const groups: PromoterGroupBaseRow[] = [{ id: 1, name: 'Alpha Presents' }];
    // Intentionally out-of-order to prove the sort actually runs.
    const venues: VenueForGroupRow[] = [
      { promoterGroupId: 1, id: 30, name: 'Zephyr Bar', address: '3 Z St' },
      { promoterGroupId: 1, id: 10, name: 'Aurora Hall', address: '1 A St' },
      { promoterGroupId: 1, id: 20, name: 'Marrickville Live', address: '2 M St' },
    ];

    const result = groupVenuesByPromoterGroup(groups, venues);

    expect(result[0].venues.map((v) => v.name)).toEqual([
      'Aurora Hall',
      'Marrickville Live',
      'Zephyr Bar',
    ]);
  });

  it('keeps venues from unrelated groups out of each other', () => {
    const groups: PromoterGroupBaseRow[] = [
      { id: 1, name: 'Alpha Presents' },
      { id: 2, name: 'Beta Concerts' },
    ];
    const venues: VenueForGroupRow[] = [
      { promoterGroupId: 1, id: 10, name: 'Aurora Hall', address: '1 A St' },
      { promoterGroupId: 2, id: 20, name: 'Bravo Club', address: '2 B St' },
      { promoterGroupId: 1, id: 11, name: 'Azalea Room', address: '11 Az St' },
    ];

    const result = groupVenuesByPromoterGroup(groups, venues);

    expect(result[0].venues.map((v) => v.id)).toEqual([10, 11]);
    expect(result[1].venues.map((v) => v.id)).toEqual([20]);
  });

  it('ignores venue rows pointing at groups not in the base list', () => {
    const groups: PromoterGroupBaseRow[] = [{ id: 1, name: 'Alpha Presents' }];
    const venues: VenueForGroupRow[] = [
      { promoterGroupId: 1, id: 10, name: 'Aurora Hall', address: '1 A St' },
      // orphan row — the caller should never produce this in practice (join
      // constraints), but the pure helper should still be defensive.
      { promoterGroupId: 99, id: 20, name: 'Bravo Club', address: '2 B St' },
    ];

    const result = groupVenuesByPromoterGroup(groups, venues);

    expect(result).toHaveLength(1);
    expect(result[0].venues).toEqual([
      { id: 10, name: 'Aurora Hall', address: '1 A St' },
    ]);
  });
});
