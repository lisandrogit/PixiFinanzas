import { describe, it, expect } from 'vitest';
import { toPeriodId, periodLabel, shiftPeriod, currentPeriod, lastClosedPeriods, nextPeriods } from '../../functions/_lib/period';

describe('period helpers', () => {
  it('builds AAAAMM ids', () => {
    expect(toPeriodId(2026, 9)).toBe(202609);
  });
  it('labels in Spanish', () => {
    expect(periodLabel(202609)).toBe('Septiembre 2026');
    expect(periodLabel(202601)).toBe('Enero 2026');
  });
  it('shifts across year boundaries', () => {
    expect(shiftPeriod(202612, 1)).toBe(202701);
    expect(shiftPeriod(202601, -1)).toBe(202512);
  });
  it('computes current period from a fixed date', () => {
    expect(currentPeriod(new Date('2026-09-12T00:00:00Z'))).toBe(202609);
  });
  it('computes last closed and next periods around the fixed "today"', () => {
    const cur = currentPeriod(new Date('2026-09-12T00:00:00Z'));
    expect(nextPeriods(cur, 3)).toEqual([202610, 202611, 202612]);
    expect(lastClosedPeriods(cur, 3)).toEqual([202606, 202607, 202608]);
    expect(lastClosedPeriods(cur, 9)).toEqual([202512, 202601, 202602, 202603, 202604, 202605, 202606, 202607, 202608]);
  });
});
