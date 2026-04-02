export function toDateStringInTimeZone(
  input: Date | number,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(input);
}

export function getTargetDate(
  now: Date,
  timeZone: string,
): { targetDate: string; localToday: string } {
  const localToday = toDateStringInTimeZone(now, timeZone);
  const priorUtcMidday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const targetDate = toDateStringInTimeZone(priorUtcMidday, timeZone);

  return { targetDate, localToday };
}

export function roundMatchesDate(
  startsAt: number,
  targetDate: string,
  timeZone: string,
): boolean {
  return toDateStringInTimeZone(startsAt, timeZone) === targetDate;
}
