import { describe, it, expect } from 'vitest';
import { getStreakCount } from './adherence';
import { format } from 'date-fns';

describe('getStreakCount', () => {
  it('should return 0 for an empty set of dates', () => {
    const takenDates = new Set<string>();
    expect(getStreakCount(takenDates)).toBe(0);
  });

  it('should return 3 for a 3-day streak ending today', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(today.getDate() - 2);

    const takenDates = new Set([
      format(today, 'yyyy-MM-dd'),
      format(yesterday, 'yyyy-MM-dd'),
      format(twoDaysAgo, 'yyyy-MM-dd'),
    ]);

    expect(getStreakCount(takenDates)).toBe(3);
  });

  it('should return 0 if today was missed', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const takenDates = new Set([
      format(yesterday, 'yyyy-MM-dd'),
    ]);

    expect(getStreakCount(takenDates)).toBe(0);
  });
});