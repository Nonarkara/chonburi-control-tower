import type { AcademicPhase } from "./types.js";

/**
 * Chulalongkorn University academic calendar — AY 2025/26 → AY 2026/27.
 * Dates from chula.ac.th/en/academic-calendar. Update annually.
 *
 * Tempo mapping (used by /api/academic-calendar):
 *   freshy-week / finals / graduation → "peak"
 *   semester-1 / semester-2          → "high"
 *   summer-term                       → "normal"
 *   break / holiday                   → "low"
 */
export const CHULA_ACADEMIC_PHASES: AcademicPhase[] = [
  // ── AY 2025/26 (current academic year) ──
  {
    id: "semester-1",
    label: "Semester 1 · 2025/26",
    start: "2025-08-11",
    end: "2025-12-05",
    describe: "First semester in session — full faculty + student presence, peak shuttle load 07:30–09:00 and 16:30–19:00.",
  },
  {
    id: "semester-1-finals",
    label: "Semester 1 finals · 2025/26",
    start: "2025-12-08",
    end: "2025-12-19",
    describe: "Final examination period — 24 h library access, traffic shifts off-peak, expect higher complaint volume around exam venues.",
  },
  {
    id: "break",
    label: "Inter-semester break",
    start: "2025-12-22",
    end: "2026-01-09",
    describe: "Between-semester break — campus quiet, shuttle on reduced timetable, parking effectively unrestricted.",
  },
  {
    id: "semester-2",
    label: "Semester 2 · 2025/26",
    start: "2026-01-12",
    end: "2026-05-08",
    describe: "Second semester in session — normal operational tempo, all faculty operations and CU POP Bus on full schedule.",
  },
  {
    id: "semester-2-finals",
    label: "Semester 2 finals · 2025/26",
    start: "2026-05-11",
    end: "2026-05-22",
    describe: "Final examination period — 24 h library, exam-hall traffic peaks, late-night demand on shuttle Line 4.",
  },
  {
    id: "graduation",
    label: "Commencement ceremony",
    start: "2026-07-02",
    end: "2026-07-03",
    describe: "Royal commencement ceremony — Ratchadamri/Henri Dunant traffic at standstill, parking lots reserved, gates 1–3 closed to public.",
  },
  {
    id: "summer-term",
    label: "Summer term · 2025/26",
    start: "2026-06-08",
    end: "2026-07-31",
    describe: "Optional summer term — reduced enrollment, light campus traffic, A/C zones partial, Centenary Park ops continue.",
  },
  // ── AY 2026/27 ──
  {
    id: "freshy-week",
    label: "Freshman orientation week · 2026/27",
    start: "2026-08-03",
    end: "2026-08-07",
    describe: "New first-year orientation across all 19 faculties — Sala Phra Kiao + Chamchuri 9 + Sports Complex all in use, expect peak shuttle demand.",
  },
  {
    id: "semester-1",
    label: "Semester 1 · 2026/27",
    start: "2026-08-10",
    end: "2026-12-04",
    describe: "First semester of the new academic year — full faculty + student presence.",
  },
  {
    id: "semester-1-finals",
    label: "Semester 1 finals · 2026/27",
    start: "2026-12-07",
    end: "2026-12-18",
    describe: "Final examination period.",
  },
];

/**
 * Public holidays observed by Chula (national holidays + Royal anniversaries).
 * Campus closes, shuttle pauses, only Chula Hospital ED stays open.
 */
export const CHULA_HOLIDAYS: AcademicPhase[] = [
  { id: "holiday", label: "Songkran",                          start: "2026-04-13", end: "2026-04-15", describe: "Thai New Year holiday — campus closed, only Chula Hospital ED open." },
  { id: "holiday", label: "Coronation Day",                    start: "2026-05-04", end: "2026-05-04", describe: "Public holiday — campus closed." },
  { id: "holiday", label: "Visakha Bucha Day",                 start: "2026-05-31", end: "2026-05-31", describe: "Buddhist holy day — campus closed." },
  { id: "holiday", label: "Queen Suthida's Birthday",          start: "2026-06-03", end: "2026-06-03", describe: "Royal anniversary — campus closed." },
  { id: "holiday", label: "Asanha Bucha + Buddhist Lent",      start: "2026-07-29", end: "2026-07-30", describe: "Buddhist holidays — campus closed." },
  { id: "holiday", label: "Queen Mother's Birthday / Mother's Day", start: "2026-08-12", end: "2026-08-12", describe: "Royal anniversary + Mother's Day — campus closed." },
  { id: "holiday", label: "King Rama IX Memorial Day",         start: "2026-10-13", end: "2026-10-13", describe: "Royal memorial — campus closed." },
  { id: "holiday", label: "Chulalongkorn Day",                 start: "2026-10-23", end: "2026-10-23", describe: "Anniversary of King Rama V (the university's namesake) — campus closed; Royal-pavilion ceremony at Sala Phra Kiao opens to public." },
  { id: "holiday", label: "King's Birthday",                   start: "2026-12-05", end: "2026-12-05", describe: "Royal anniversary + Father's Day — campus closed." },
  { id: "holiday", label: "Constitution Day",                  start: "2026-12-10", end: "2026-12-10", describe: "Public holiday — campus closed." },
  { id: "holiday", label: "New Year's Eve / Day",              start: "2026-12-31", end: "2027-01-02", describe: "New Year holidays — campus closed." },
];

export const CHULA_CALENDAR_ALL: AcademicPhase[] = [...CHULA_ACADEMIC_PHASES, ...CHULA_HOLIDAYS];
