import type { PickupLocation, DropoffLocation } from "./ride-types";

/**
 * Generate a simple curved route between pickup and dropoff.
 * Returns a GeoJSON FeatureCollection with a LineString.
 */
export function generateRouteGeoJson(
  pickup: PickupLocation,
  dropoff: DropoffLocation
): GeoJSON.FeatureCollection {
  const steps = 20;
  const coords: [number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = pickup.lat + (dropoff.lat - pickup.lat) * t;
    const lng = pickup.lng + (dropoff.lng - pickup.lng) * t;
    // Add slight curve offset
    const offset = Math.sin(t * Math.PI) * 0.002;
    coords.push([lng + offset, lat]);
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: coords,
        },
      },
    ],
  };
}

/**
 * Interpolate a position along a route at a given fraction (0-1).
 */
export function interpolateAlongRoute(
  coords: [number, number][],
  fraction: number
): { lng: number; lat: number } {
  const clamped = Math.max(0, Math.min(1, fraction));
  const index = clamped * (coords.length - 1);
  const lower = Math.floor(index);
  const upper = Math.min(lower + 1, coords.length - 1);
  const t = index - lower;

  return {
    lng: coords[lower][0] + (coords[upper][0] - coords[lower][0]) * t,
    lat: coords[lower][1] + (coords[upper][1] - coords[lower][1]) * t,
  };
}

/**
 * Ease-in-out function for realistic car movement.
 */
export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
