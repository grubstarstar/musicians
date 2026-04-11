import { describe, it, expect } from 'vitest';
import { formatDuration, getProgress } from './playerUtils';

describe('formatDuration', () => {
  it('formats whole minutes and seconds', () => {
    expect(formatDuration(90)).toBe('1:30');
  });

  it('pads seconds below 10 with a leading zero', () => {
    expect(formatDuration(65)).toBe('1:05');
  });

  it('returns 0:00 for zero seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  it('handles sub-minute values', () => {
    expect(formatDuration(45)).toBe('0:45');
  });

  it('truncates fractional seconds', () => {
    expect(formatDuration(61.9)).toBe('1:01');
  });

  it('handles large values correctly', () => {
    expect(formatDuration(3661)).toBe('61:01');
  });

  it('returns 0:00 for negative input', () => {
    expect(formatDuration(-5)).toBe('0:00');
  });

  it('returns 0:00 for NaN', () => {
    expect(formatDuration(NaN)).toBe('0:00');
  });

  it('returns 0:00 for Infinity', () => {
    expect(formatDuration(Infinity)).toBe('0:00');
  });
});

describe('getProgress', () => {
  it('returns the percentage of currentTime relative to duration', () => {
    expect(getProgress(30, 120)).toBe(25);
  });

  it('returns 0 when currentTime is 0', () => {
    expect(getProgress(0, 120)).toBe(0);
  });

  it('returns 100 when currentTime equals duration', () => {
    expect(getProgress(120, 120)).toBe(100);
  });

  it('clamps to 100 when currentTime exceeds duration', () => {
    expect(getProgress(130, 120)).toBe(100);
  });

  it('returns 0 when duration is 0', () => {
    expect(getProgress(30, 0)).toBe(0);
  });

  it('returns 0 when duration is NaN', () => {
    expect(getProgress(30, NaN)).toBe(0);
  });

  it('returns 0 when duration is Infinity', () => {
    expect(getProgress(30, Infinity)).toBe(0);
  });
});
