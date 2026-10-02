"use client";
import { useState } from "react";
import { MONTHS, toMonthInput } from "@/lib/dates";
import { Select } from "@/components/ui/input";

const CURRENT_YEAR = new Date().getUTCFullYear();
const YEAR_RANGE = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - 6 + i); // a few years back, a few ahead

/**
 * Month + year picker built from two dropdowns rather than the browser's native
 * <input type="month"> (whose calendar-popup UI varies a lot across browsers). Value and
 * onChange are always "YYYY-MM" strings, matching toMonthInput/fromMonthInput.
 *
 * Works two ways:
 * - Native form submission: pass `name`, leave `value`/`onChange` unset — a hidden input carries
 *   the combined value under that name, same as a plain <input type="month" name="...">.
 * - Client-managed state: pass `value` + `onChange`, no `name` needed.
 */
export function MonthDropdown({
  name,
  value,
  defaultValue,
  onChange,
  className,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultValue || value || toMonthInput(new Date()));
  const current = value || internal;
  const [y, m] = current.split("-");

  function update(nextY: string, nextM: string) {
    const next = `${nextY}-${nextM}`;
    setInternal(next);
    onChange?.(next);
  }

  return (
    <div className={`flex gap-1 ${className ?? ""}`}>
      {name && <input type="hidden" name={name} value={current} />}
      <Select value={m} onChange={(e) => update(y, e.target.value)} className="h-9 w-32 text-sm" aria-label="Month">
        {MONTHS.map((label, i) => (
          <option key={label} value={String(i + 1).padStart(2, "0")}>
            {label}
          </option>
        ))}
      </Select>
      <Select value={y} onChange={(e) => update(e.target.value, m)} className="h-9 w-24 text-sm" aria-label="Year">
        {YEAR_RANGE.map((yr) => (
          <option key={yr} value={String(yr)}>
            {yr}
          </option>
        ))}
      </Select>
    </div>
  );
}
