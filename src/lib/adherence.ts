import { format, eachDayOfInterval, startOfMonth } from 'date-fns';

export const getStreakCount = (takenDatesSet: Set<string>): number => {
  let streak = 0;
  let currentDate = new Date();
  while (takenDatesSet.has(format(currentDate, 'yyyy-MM-dd'))) {
    streak++;
    currentDate.setDate(currentDate.getDate() - 1);
  }
  return streak;
};