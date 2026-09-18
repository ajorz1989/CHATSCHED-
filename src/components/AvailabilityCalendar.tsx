import { useState } from "react";
import { useAvailability } from "../hooks/useAvailability";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_ABBR = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Props {
  publisherId: string;
  canEdit?: boolean;
}

export default function AvailabilityCalendar({ publisherId, canEdit = false }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const { isBlocked, toggleDate } = useAvailability(publisherId);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  // Build grid: leading nulls + date objects
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  // Pad to complete last week
  while (cells.length % 7 !== 0) cells.push(null);

  function dayClass(d: Date): string {
    const str = toDateStr(d);
    const isPast = d < today;
    const blocked = isBlocked(str);
    const isToday = d.getTime() === today.getTime();

    let cls = "relative flex items-center justify-center text-sm rounded-md font-semibold transition-all select-none ";

    if (isPast) {
      cls += "text-billboard-inkSoft opacity-35 cursor-default ";
    } else if (blocked) {
      cls += "bg-billboard-red text-white cursor-pointer hover:opacity-85 ";
    } else {
      cls += canEdit
        ? "text-billboard-ink hover:bg-billboard-green hover:text-white cursor-pointer "
        : "text-billboard-ink bg-white ";
    }

    if (isToday) cls += "ring-2 ring-offset-1 ring-billboard-ink ";

    return cls;
  }

  const blockedInView = cells.filter(d => d && isBlocked(toDateStr(d))).length;
  const availableInView = cells.filter(d => d && !isBlocked(toDateStr(d)) && d >= today).length;

  return (
    <div className="border-[3px] border-billboard-ink rounded overflow-hidden bg-white">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 py-3.5 bg-billboard-paperDim border-b-2 border-billboard-ink">
        <button
          onClick={prevMonth}
          className="w-8 h-8 flex items-center justify-center border-2 border-billboard-ink rounded hover:bg-white transition font-bold text-lg leading-none"
          aria-label="Previous month"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="font-bold text-sm">{MONTH_NAMES[month]} {year}</p>
          {!canEdit && (
            <p className="text-[10px] font-mono uppercase text-billboard-inkSoft mt-0.5">
              {availableInView} available · {blockedInView} blocked
            </p>
          )}
        </div>
        <button
          onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center border-2 border-billboard-ink rounded hover:bg-white transition font-bold text-lg leading-none"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 bg-billboard-paperDim border-b border-billboard-paperDim px-2 pt-2">
        {DAY_ABBR.map(d => (
          <div key={d} className="text-center text-[10px] font-mono uppercase text-billboard-inkSoft pb-2">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 p-2">
        {cells.map((d, i) => {
          if (!d) return <div key={`e-${i}`} />;
          const str = toDateStr(d);
          const isPast = d < today;
          return (
            <button
              key={str}
              disabled={isPast || !canEdit}
              onClick={() => canEdit && !isPast && toggleDate(str)}
              className={`aspect-square ${dayClass(d)}`}
              title={canEdit && !isPast ? (isBlocked(str) ? "Click to mark available" : "Click to block this date") : undefined}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      {/* Legend + note */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-3 border-t-2 border-billboard-paperDim bg-billboard-paperDim text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-white border-2 border-billboard-ink inline-block shrink-0" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-billboard-red inline-block shrink-0" />
          Unavailable
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-billboard-inkSoft opacity-30 inline-block shrink-0" />
          Past
        </span>
        {canEdit ? (
          <span className="ml-auto text-billboard-inkSoft">Click any future date to toggle availability</span>
        ) : (
          <span className="ml-auto text-billboard-inkSoft">Check availability before requesting</span>
        )}
      </div>
    </div>
  );
}
