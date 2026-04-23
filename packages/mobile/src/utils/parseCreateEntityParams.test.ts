import { describe, expect, it } from 'vitest';
import { parseCreateEntityParams } from './parseCreateEntityParams';

describe('parseCreateEntityParams', () => {
  it('accepts the four onboarding branch combinations', () => {
    expect(
      parseCreateEntityParams({ entityType: 'band', memberMode: 'band' }),
    ).toEqual({ entityType: 'band', memberMode: 'band' });
    expect(
      parseCreateEntityParams({ entityType: 'band', memberMode: 'solo' }),
    ).toEqual({ entityType: 'band', memberMode: 'solo' });
    expect(
      parseCreateEntityParams({
        entityType: 'promoterGroup',
        memberMode: 'promoterGroup',
      }),
    ).toEqual({ entityType: 'promoterGroup', memberMode: 'promoterGroup' });
    expect(
      parseCreateEntityParams({
        entityType: 'promoterGroup',
        memberMode: 'solo',
      }),
    ).toEqual({ entityType: 'promoterGroup', memberMode: 'solo' });
  });

  it('rejects mismatched memberMode for the entity', () => {
    expect(
      parseCreateEntityParams({
        entityType: 'band',
        memberMode: 'promoterGroup',
      }),
    ).toBeNull();
    expect(
      parseCreateEntityParams({
        entityType: 'promoterGroup',
        memberMode: 'band',
      }),
    ).toBeNull();
  });

  it('rejects unknown entityType / memberMode values', () => {
    expect(
      parseCreateEntityParams({ entityType: 'studio', memberMode: 'band' }),
    ).toBeNull();
    expect(
      parseCreateEntityParams({ entityType: 'band', memberMode: 'session' }),
    ).toBeNull();
  });

  it('rejects missing params', () => {
    expect(parseCreateEntityParams({})).toBeNull();
    expect(parseCreateEntityParams({ entityType: 'band' })).toBeNull();
    expect(parseCreateEntityParams({ memberMode: 'band' })).toBeNull();
  });

  it('uses the first value when expo-router hands an array (repeated key)', () => {
    expect(
      parseCreateEntityParams({
        entityType: ['band', 'promoterGroup'],
        memberMode: ['band'],
      }),
    ).toEqual({ entityType: 'band', memberMode: 'band' });
  });

  it('rejects empty arrays', () => {
    expect(
      parseCreateEntityParams({ entityType: [], memberMode: 'band' }),
    ).toBeNull();
  });
});
