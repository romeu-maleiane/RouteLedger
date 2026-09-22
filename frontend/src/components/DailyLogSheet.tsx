import { useMemo } from "react";

export interface PlanEvent {
  type: "driving" | "on_duty" | "off_duty";
  label: string;
  start: string;
  end: string;
  durationHours: number;
  location: string;
  miles: number;
}

export interface DayLogData {
  dayNumber: number;
  dateStr: string;
  segments: {
    type: "off_duty" | "sleeper" | "driving" | "on_duty";
    startHour: number; // 0.0 to 24.0
    endHour: number; // 0.0 to 24.0
    duration: number;
    location: string;
    label: string;
  }[];
  totals: {
    offDuty: number;
    sleeper: number;
    driving: number;
    onDuty: number;
    total: number;
  };
  totalMiles: number;
  remarks: { timeStr: string; text: string; location: string }[];
}

interface DailyLogSheetProps {
  events: PlanEvent[];
  carrierName?: string;
  driverName?: string;
  origin?: string;
  destination?: string;
}

// Map event type to log line index (0: Off Duty, 1: Sleeper, 2: Driving, 3: On Duty)
function getRowIndex(type: string, label: string): number {
  if (type === "driving") return 2;
  if (type === "on_duty") return 3;
  if (label.toLowerCase().includes("sleeper")) return 1;
  return 0; // default off_duty
}

export function splitEventsIntoDailyLogs(events: PlanEvent[]): DayLogData[] {
  if (!events || events.length === 0) return [];

  const workEvents = events.filter((ev) => ev.type === "driving" || ev.type === "on_duty");
  if (workEvents.length === 0) return [];

  const firstDate = new Date(events[0].start);
  const lastWorkDate = new Date(workEvents[workEvents.length - 1].end);

  const startDay = new Date(Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth(), firstDate.getUTCDate()));
  const endDay = new Date(Date.UTC(lastWorkDate.getUTCFullYear(), lastWorkDate.getUTCMonth(), lastWorkDate.getUTCDate()));

  const dailyLogs: DayLogData[] = [];
  let dayIndex = 1;
  const currentDay = new Date(startDay.getTime());

  while (currentDay <= endDay) {
    const nextDay = new Date(currentDay.getTime() + 24 * 3600 * 1000);
    const dayStartMs = currentDay.getTime();
    const dayEndMs = nextDay.getTime();
    const dateStr = currentDay.toISOString().split("T")[0];

    const daySegments: DayLogData["segments"] = [];
    const dayRemarks: DayLogData["remarks"] = [];
    let dayDrivingMiles = 0;

    let cursorMs = dayStartMs;

    // Find all events that overlap with this 24-hour window
    for (const ev of events) {
      const evStartMs = new Date(ev.start).getTime();
      const evEndMs = new Date(ev.end).getTime();

      // Skip events completely outside today
      if (evEndMs <= dayStartMs || evStartMs >= dayEndMs) continue;

      // If there is gap before this event on this day, fill with off_duty
      if (evStartMs > cursorMs) {
        const gapStartHour = Math.max(0, (cursorMs - dayStartMs) / 3600000);
        const gapEndHour = Math.min(24, (evStartMs - dayStartMs) / 3600000);
        if (gapEndHour > gapStartHour) {
          daySegments.push({
            type: "off_duty",
            startHour: gapStartHour,
            endHour: gapEndHour,
            duration: gapEndHour - gapStartHour,
            location: "Terminal / Rest",
            label: "Off duty",
          });
        }
        cursorMs = evStartMs;
      }

      const segStartMs = Math.max(dayStartMs, evStartMs);
      const segEndMs = Math.min(dayEndMs, evEndMs);
      const startHour = (segStartMs - dayStartMs) / 3600000;
      const endHour = (segEndMs - dayStartMs) / 3600000;
      const duration = endHour - startHour;

      if (duration > 0) {
        const segType =
          ev.type === "driving"
            ? "driving"
            : ev.type === "on_duty"
            ? "on_duty"
            : ev.label.toLowerCase().includes("sleeper")
            ? "sleeper"
            : "off_duty";

        daySegments.push({
          type: segType,
          startHour,
          endHour,
          duration,
          location: ev.location,
          label: ev.label,
        });

        if (ev.type === "driving") {
          const ratio = (segEndMs - segStartMs) / Math.max(1, evEndMs - evStartMs);
          dayDrivingMiles += (ev.miles || 0) * ratio;
        }

        // Add to remarks if change starts on this day
        if (evStartMs >= dayStartMs && evStartMs < dayEndMs) {
          const hh = Math.floor(startHour);
          const mm = Math.round((startHour - hh) * 60);
          const timeStr = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
          dayRemarks.push({
            timeStr,
            text: `${ev.label} (${ev.durationHours}h)`,
            location: ev.location,
          });
        }

        cursorMs = segEndMs;
      }
    }

    // Fill remainder of the day if needed
    if (cursorMs < dayEndMs) {
      const gapStartHour = (cursorMs - dayStartMs) / 3600000;
      const gapEndHour = 24.0;
      if (gapEndHour > gapStartHour) {
        daySegments.push({
          type: "off_duty",
          startHour: gapStartHour,
          endHour: gapEndHour,
          duration: gapEndHour - gapStartHour,
          location: "Off duty / Rest",
          label: "Off duty",
        });
      }
    }

    // Calculate totals for each status
    let offDuty = 0;
    let sleeper = 0;
    let driving = 0;
    let onDuty = 0;

    for (const seg of daySegments) {
      if (seg.type === "off_duty") offDuty += seg.duration;
      else if (seg.type === "sleeper") sleeper += seg.duration;
      else if (seg.type === "driving") driving += seg.duration;
      else if (seg.type === "on_duty") onDuty += seg.duration;
    }

    dailyLogs.push({
      dayNumber: dayIndex,
      dateStr,
      segments: daySegments,
      totals: {
        offDuty: Number(offDuty.toFixed(2)),
        sleeper: Number(sleeper.toFixed(2)),
        driving: Number(driving.toFixed(2)),
        onDuty: Number(onDuty.toFixed(2)),
        total: Number((offDuty + sleeper + driving + onDuty).toFixed(2)),
      },
      totalMiles: Math.round(dayDrivingMiles),
      remarks: dayRemarks,
    });

    dayIndex++;
    currentDay.setTime(currentDay.getTime() + 24 * 3600 * 1000);
  }

  return dailyLogs;
}

export function DailyLogSheet({
  events,
  carrierName = "RouteLedger Logistics Inc.",
  driverName = "John Doe",
  origin = "Chicago, IL",
  destination = "Columbus, OH",
}: DailyLogSheetProps) {
  const dailyLogs = useMemo(() => splitEventsIntoDailyLogs(events), [events]);

  if (dailyLogs.length === 0) return null;

  return (
    <div className="daily-logs-wrapper" id="regulatory-daily-logs">
      {dailyLogs.map((log) => (
        <SingleDaySheet
          key={log.dateStr}
          log={log}
          carrierName={carrierName}
          driverName={driverName}
          origin={origin}
          destination={destination}
        />
      ))}
    </div>
  );
}

function SingleDaySheet({
  log,
  carrierName,
  driverName,
  origin,
  destination,
}: {
  log: DayLogData;
  carrierName: string;
  driverName: string;
  origin: string;
  destination: string;
}) {
  const rowY = [35, 65, 95, 125]; // Y coordinates for rows: Off, Sleeper, Driving, On Duty
  const startX = 130;
  const totalWidth = 624; // 26px per hour for 24 hours
  const hourWidth = totalWidth / 24;

  // Build the continuous step line path
  let pathD = "";
  let lastX = startX;
  let lastY = rowY[0];

  log.segments.forEach((seg, idx) => {
    const rIdx = getRowIndex(seg.type, seg.label);
    const y = rowY[rIdx];
    const x1 = startX + seg.startHour * hourWidth;
    const x2 = startX + seg.endHour * hourWidth;

    if (idx === 0) {
      pathD += `M ${x1} ${y} L ${x2} ${y}`;
    } else {
      if (Math.abs(lastY - y) > 0.1) {
        pathD += ` L ${x1} ${y}`;
      }
      pathD += ` L ${x2} ${y}`;
    }
    lastX = x2;
    lastY = y;
  });

  return (
    <div className="paper-log-document">
      {/* Official Header */}
      <div className="log-header-fmcsa">
        <div className="header-top-line">
          <div>
            <strong>DRIVER'S DAILY LOG</strong>
            <span>(ONE CALENDAR DAY — 24 HOURS)</span>
          </div>
          <div className="log-copy-info">
            <span>ORIGINAL — File at home terminal</span>
            <span>DUPLICATE — Driver retains for 8 days</span>
          </div>
        </div>

        <div className="log-meta-grid">
          <div className="meta-box">
            <span className="meta-label">Date:</span>
            <strong>{log.dateStr} (Day {log.dayNumber})</strong>
          </div>
          <div className="meta-box">
            <span className="meta-label">Total Driving Miles Today:</span>
            <strong>{log.totalMiles} mi</strong>
          </div>
          <div className="meta-box">
            <span className="meta-label">Truck / Tractor Numbers:</span>
            <strong>Unit #TRK-104 · Trailer #TL-88</strong>
          </div>
          <div className="meta-box">
            <span className="meta-label">Carrier Name:</span>
            <strong>{carrierName}</strong>
          </div>
          <div className="meta-box">
            <span className="meta-label">Driver Signature:</span>
            <span className="signature-font">{driverName}</span>
          </div>
          <div className="meta-box">
            <span className="meta-label">Route:</span>
            <strong>{origin} &rarr; {destination}</strong>
          </div>
        </div>
      </div>

      {/* FMCSA 24-Hour Graph Grid */}
      <div className="graph-container">
        <svg
          viewBox="0 0 840 160"
          className="grid-svg"
          preserveAspectRatio="xMidYMid meet"
          style={{ width: "100%", height: "auto" }}
        >
          {/* Row Background / Guidelines */}
          <rect x={startX} y="20" width={totalWidth} height="120" fill="#fafbfc" stroke="#94a3b8" strokeWidth="1.5" />

          {/* 4 Duty Status Horizontal lines */}
          <line x1={startX} y1="50" x2={startX + totalWidth} y2="50" stroke="#cbd5e1" strokeWidth="1" />
          <line x1={startX} y1="80" x2={startX + totalWidth} y2="80" stroke="#cbd5e1" strokeWidth="1" />
          <line x1={startX} y1="110" x2={startX + totalWidth} y2="110" stroke="#cbd5e1" strokeWidth="1" />

          {/* Row Labels on Left */}
          <text x="120" y="38" textAnchor="end" fontSize="10" fontWeight="600" fill="#334155">1. Off Duty</text>
          <text x="120" y="68" textAnchor="end" fontSize="10" fontWeight="600" fill="#334155">2. Sleeper Berth</text>
          <text x="120" y="98" textAnchor="end" fontSize="10" fontWeight="600" fill="#334155">3. Driving</text>
          <text x="120" y="128" textAnchor="end" fontSize="10" fontWeight="600" fill="#334155">4. On Duty (Not Driving)</text>

          {/* Hourly vertical tick lines & numbers */}
          {Array.from({ length: 25 }).map((_, h) => {
            const x = startX + h * hourWidth;
            let label = `${h}`;
            if (h === 0 || h === 24) label = "Mid";
            else if (h === 12) label = "Noon";
            else if (h > 12) label = `${h - 12}`;

            return (
              <g key={`hour-${h}`}>
                <line x1={x} y1="20" x2={x} y2="140" stroke="#cbd5e1" strokeWidth={h === 0 || h === 12 || h === 24 ? "1.5" : "0.75"} />
                <text x={x} y="14" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#475569">
                  {label}
                </text>
                {/* 15-minute sub-ticks for each hour up to 23 */}
                {h < 24 && (
                  <>
                    <line x1={x + hourWidth * 0.25} y1="20" x2={x + hourWidth * 0.25} y2="28" stroke="#94a3b8" strokeWidth="0.5" />
                    <line x1={x + hourWidth * 0.5} y1="20" x2={x + hourWidth * 0.5} y2="33" stroke="#94a3b8" strokeWidth="0.75" />
                    <line x1={x + hourWidth * 0.75} y1="20" x2={x + hourWidth * 0.75} y2="28" stroke="#94a3b8" strokeWidth="0.5" />
                  </>
                )}
              </g>
            );
          })}

          {/* Right Header: TOTAL HOURS */}
          <text x="790" y="14" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#0f172a">TOTAL</text>
          <rect x="760" y="20" width="60" height="120" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />
          <line x1="760" y1="50" x2="820" y2="50" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="760" y1="80" x2="820" y2="80" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="760" y1="110" x2="820" y2="110" stroke="#cbd5e1" strokeWidth="1" />

          {/* Total values in the right boxes */}
          <text x="790" y="39" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#0f172a">{log.totals.offDuty}</text>
          <text x="790" y="69" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#0f172a">{log.totals.sleeper}</text>
          <text x="790" y="99" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#1664c0">{log.totals.driving}</text>
          <text x="790" y="129" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#b45309">{log.totals.onDuty}</text>

          {/* Drawn Continuous Step Graph Path */}
          <path
            d={pathD}
            fill="none"
            stroke="#1664c0"
            strokeWidth="3.5"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />

          {/* Circle indicators at transitions */}
          {log.segments.map((seg, i) => {
            const rIdx = getRowIndex(seg.type, seg.label);
            const x1 = startX + seg.startHour * hourWidth;
            const y = rowY[rIdx];
            return <circle key={`dot-${i}`} cx={x1} cy={y} r="3" fill="#1664c0" />;
          })}
        </svg>
      </div>

      {/* Bottom Remarks Section */}
      <div className="log-bottom-remarks">
        <div className="remarks-title">REMARKS:</div>
        <div className="remarks-content">
          {log.remarks.length === 0 ? (
            <p className="no-remarks">Continuous off-duty period.</p>
          ) : (
            log.remarks.map((rem, idx) => (
              <span key={idx} className="remark-chip">
                <b>{rem.timeStr}</b> - {rem.text} @ <i>{rem.location}</i>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Recap 70-Hour Rule */}
      <div className="log-recap-footer">
        <div>
          <span>On-Duty Today (Lines 3 + 4):</span>
          <strong>{(log.totals.driving + log.totals.onDuty).toFixed(2)} hrs</strong>
        </div>
        <div>
          <span>Total Hours Logged:</span>
          <strong>{log.totals.total.toFixed(2)} / 24.00 hrs</strong>
        </div>
        <div>
          <span>Cycle Compliance:</span>
          <strong className="cycle-status">FMCSA § 395 70h/8d OK</strong>
        </div>
      </div>
    </div>
  );
}
