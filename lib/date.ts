const createLocalNoon = (year: number, monthIndex: number, day: number) =>
  new Date(year, monthIndex, day, 12, 0, 0, 0);

export const toLocalNoon = (date: Date) =>
  createLocalNoon(date.getFullYear(), date.getMonth(), date.getDate());

export const toDateKey = (date: Date) => {
  const normalized = toLocalNoon(date);
  const year = normalized.getFullYear();
  const month = String(normalized.getMonth() + 1).padStart(2, '0');
  const day = String(normalized.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const fromDateKey = (dateKey: string) => {
  const matched = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) return toLocalNoon(new Date());

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);

  const normalized = createLocalNoon(year, month - 1, day);
  if (
    normalized.getFullYear() !== year ||
    normalized.getMonth() !== month - 1 ||
    normalized.getDate() !== day
  ) {
    return toLocalNoon(new Date());
  }

  return normalized;
};

export const startOfMonth = (date: Date) => createLocalNoon(date.getFullYear(), date.getMonth(), 1);

export const addDays = (date: Date, amount: number) => {
  const normalized = toLocalNoon(date);
  normalized.setDate(normalized.getDate() + amount);
  return toLocalNoon(normalized);
};

export const isSameDay = (a: Date, b: Date) => toDateKey(a) === toDateKey(b);

export const daysInMonth = (date: Date) => {
  const normalized = toLocalNoon(date);
  return new Date(normalized.getFullYear(), normalized.getMonth() + 1, 0).getDate();
};

