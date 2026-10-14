/**
 * Geographic calculation utilities using the Haversine formula
 * and travel time estimators for Mozambique urban conditions (Maputo, Matola, Beira, etc.).
 */

/**
 * Calculates the great-circle distance between two points on a sphere
 * using the Haversine formula.
 * @param pos1 [latitude, longitude] in degrees
 * @param pos2 [latitude, longitude] in degrees
 * @returns distance in kilometers
 */
export function calculateHaversineDistanceKm(
  pos1: [number, number],
  pos2: [number, number]
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((pos2[0] - pos1[0]) * Math.PI) / 180;
  const dLon = ((pos2[1] - pos1[1]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((pos1[0] * Math.PI) / 180) *
      Math.cos((pos2[0] * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface TravelTimeEstimate {
  distanceKm: number;
  formattedDistance: string;
  carMinutes: number;      // Carro / Chapa (urban average ~28 km/h + traffic)
  motoMinutes: number;     // Moto / Txopela (agile urban transit ~32 km/h)
  walkingMinutes: number;  // A pé / Caminhada (~4.5 km/h)
  primaryEtaText: string;  // Most logical ETA to highlight
}

/**
 * Calculates realistic travel time estimates between two points based on Haversine distance.
 * Accounts for real-world Mozambique urban road conditions (chapa stops, traffic, city blocks).
 */
export function estimateTravelTime(distanceKm: number): TravelTimeEstimate {
  // Real world urban speeds:
  // Walking: 4.5 km/h
  // Car / Chapa in city traffic: ~28 km/h with 2 minutes starting buffer
  // Moto / Txopela (tuk-tuk): ~32 km/h with 1 minute starting buffer
  const walkingMinutes = Math.max(1, Math.round((distanceKm / 4.5) * 60));
  const carMinutes = Math.max(2, Math.round((distanceKm / 28) * 60 + 2));
  const motoMinutes = Math.max(1, Math.round((distanceKm / 32) * 60 + 1));

  const formattedDistance =
    distanceKm >= 1
      ? `${distanceKm.toFixed(1)} km`
      : `${Math.round(distanceKm * 1000)} m`;

  const primaryEtaText =
    distanceKm < 0.9
      ? `~${walkingMinutes} min a pé`
      : `~${carMinutes} min de carro / chapa`;

  return {
    distanceKm,
    formattedDistance,
    carMinutes,
    motoMinutes,
    walkingMinutes,
    primaryEtaText,
  };
}

/**
 * Stable, deterministic coordinate derivation for providers relative to the user position.
 * Prevents provider markers from randomly jumping across rerenders while ensuring
 * consistent distances and realistic neighborhood spreads.
 */
export function getProviderCoordinates(
  providerId: string,
  userPos: [number, number]
): [number, number] {
  let hash1 = 0;
  for (let i = 0; i < providerId.length; i++) {
    hash1 = providerId.charCodeAt(i) + ((hash1 << 5) - hash1);
  }
  const randLat = Math.abs(Math.sin(hash1) * 10000) % 1;
  const randLng = Math.abs(Math.cos(hash1) * 10000) % 1;

  const providerLat = userPos[0] + (randLat - 0.5) * 0.014;
  const providerLng = userPos[1] + (randLng - 0.5) * 0.014;
  return [providerLat, providerLng];
}
