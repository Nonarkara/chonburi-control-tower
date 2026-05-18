import { PEAK_HOURS } from "../sim/trafficSim";

interface Props {
  hour: number;
  isWeekend: boolean;
  onHourChange: (h: number) => void;
  onWeekendToggle: (w: boolean) => void;
}

const fmt = (h: number) => `${h.toString().padStart(2, "0")}:00`;

export function HourRail({ hour, isWeekend, onHourChange, onWeekendToggle }: Props) {
  return (
    <div className="hour-rail">
      <div className="spread">
        <div>
          <span className="eyebrow">Traffic — hour of day</span>
          <div className="mono" style={{ fontSize: "1.1rem", marginTop: 2 }}>
            {fmt(hour)} <span style={{ color: "var(--text-3)", fontSize: "0.7rem" }}>local</span>
          </div>
        </div>
        <div className="row">
          <button
            onClick={() => onWeekendToggle(false)}
            aria-pressed={!isWeekend}
            className={!isWeekend ? "active" : ""}
          >
            Weekday
          </button>
          <button
            onClick={() => onWeekendToggle(true)}
            aria-pressed={isWeekend}
            className={isWeekend ? "active" : ""}
          >
            Weekend
          </button>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={23}
        step={1}
        value={hour}
        onChange={(e) => onHourChange(Number(e.target.value))}
        aria-label="Hour of day"
      />
      <div className="ticks" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} className={`tick ${PEAK_HOURS.has(i) ? "peak" : ""}`} />
        ))}
      </div>
    </div>
  );
}
