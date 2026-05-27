/**
 * Pure PMCU (Pattaya / Municipality Operations) simulation helpers —
 * extracted from PmcuBrief.tsx for unit testing.
 *
 * These drive the PART MODELLED municipality operations panel: all output
 * is derived from Gaussian peak models, not live sensor data.
 */

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
export function hourlyLoad(hour: number, isWeekend: boolean): number {
  const morningPeak = Math.exp(-((hour - 8) ** 2) / 1.8);
  const eveningPeak = Math.exp(-((hour - 17.5) ** 2) / 2.4);
  const overnight = hour >= 22 || hour < 5 ? 0.12 : 0.55;
  const weekendFactor = isWeekend ? 0.55 : 1;
  return Math.min(1.15, overnight + weekendFactor * 0.95 * Math.max(morningPeak, eveningPeak));
}
