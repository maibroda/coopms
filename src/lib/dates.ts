/** Date helpers. All business dates are handled as UTC midnight to match Postgres DATE columns. */
export function d(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

export function iso(date: Date | string | null | undefined): string {
  if (!date) return "";
  const x = typeof date === "string" ? new Date(date) : date;
  return x.toISOString().slice(0, 10);
}

export function monthStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

/** Add `n` calendar months to a month-start date, returning the 1st of the resulting month. */
export function addMonths(date: Date, n: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n, 1));
}

export function monthsBetween(from: Date, to: Date): number {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
}

export function fmtDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const x = typeof date === "string" ? new Date(date) : date;
  return x.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function periodName(date: Date | string): string {
  const x = typeof date === "string" ? new Date(date) : date;
  return `${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
}

/** value="YYYY-MM" <input type="month"> helpers */
export function toMonthInput(date: Date | string): string {
  const x = typeof date === "string" ? new Date(date) : date;
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function fromMonthInput(value: string): Date {
  const [y, m] = value.split("-").map(Number);
  return monthStart(y, m);
}
