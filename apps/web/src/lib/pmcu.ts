/**
 * Pure PMCU (Pattaya / Municipality Operations) simulation helpers —
 * extracted from PmcuBrief.tsx for unit testing.
 *
 * These drive the PART MODELLED municipality operations panel: all output
 * is derived from Gaussian peak models, not live sensor data.
 */

export interface ParkingZone {
  id: string;      // "P1"–"P4" — second char digit encodes the offset index
  name: string;
  capacity: number;
}

/**
 * Compute the normalised municipality service load [0, 1.15] for a given
 * hour of the day using a dual-Gaussian peak model.
 *
 * Peaks:
 *   Morning: Gaussian centred at 08:00 (σ² ≈ 1.8)
 *   Evening: Gaussian centred at 17:30 (σ² ≈ 2.4)
 *   Overnight (22:00–05:00): base 0.12 else 0.55
 *
 * @param hour      Integer or fractional hour in [0, 24)
 * @param isWeekend Weekend multiplier reduces peak load by 45 %
 * @returns Load factor; can slightly exceed 1.0 on busy weekday peaks
 */
/**
 * Model parking-zone occupancy [0, 0.98] for a given zone, hour, and day type.
 *
 * The zone ID second character encodes a Gaussian peak offset so adjacent zones
 * reach their peak at slightly different times — avoiding an unrealistic spike
 * where all zones simultaneously reach 100%.
 *
 * @param zone      Parking zone with id like "P1"–"P4"
 * @param hour      Hour of day [0, 24)
 * @param isWeekend Weekend reduces peak occupancy by ~55 %
 */
export function zoneOccupancy(zone: ParkingZone, hour: number, isWeekend: boolean): number {
  const offset = (zone.id.charCodeAt(1) - 49) * 0.35;
  const adjusted = hour + offset;
  const morning = Math.exp(-((adjusted - 9.5) ** 2) / 4);
  const afternoon = Math.exp(-((adjusted - 14) ** 2) / 7);
  const evening = Math.exp(-((adjusted - 18) ** 2) / 4);
  const overnight = adjusted >= 22 || adjusted < 6 ? 0.05 : 0.2;
  const base = overnight + Math.max(morning, afternoon, evening) * (isWeekend ? 0.45 : 0.92);
  return Math.min(0.98, base);
}

export function hourlyLoad(hour: number, isWeekend: boolean): number {
  const morningPeak = Math.exp(-((hour - 8) ** 2) / 1.8);
  const eveningPeak = Math.exp(-((hour - 17.5) ** 2) / 2.4);
  const overnight = hour >= 22 || hour < 5 ? 0.12 : 0.55;
  const weekendFactor = isWeekend ? 0.55 : 1;
  return Math.min(1.15, overnight + weekendFactor * 0.95 * Math.max(morningPeak, eveningPeak));
}
