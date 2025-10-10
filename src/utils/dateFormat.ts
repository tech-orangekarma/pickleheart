import { format, isToday, isTomorrow, addDays, startOfDay } from "date-fns";

export function formatPlannedVisitDate(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEEE"); // Day name (Monday, Tuesday, etc.)
}

export function getMaxPlanningDate(): Date {
  return addDays(startOfDay(new Date()), 7);
}
