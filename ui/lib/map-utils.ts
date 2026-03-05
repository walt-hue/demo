import bearing from "@turf/bearing";
import { point } from "@turf/helpers";
import type {
  PickupLocation,
  DropoffLocation,
  DriverState,
  DriverInfo,
  CameraState,
  RidePhase,
} from "./ride-types";

/**
 * Generate a simple curved route between pickup and dropoff.
 * Returns a GeoJSON FeatureCollection with a LineString.
 */
export function generateRouteGeoJson(
  pickup: PickupLocation,
  dropoff: DropoffLocation
): GeoJSON.FeatureCollection {
  const steps = 50;
  const coords: [number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = pickup.lat + (dropoff.lat - pickup.lat) * t;
    const lng = pickup.lng + (dropoff.lng - pickup.lng) * t;
    // Add slight curve offset for realistic road feel
    const offset = Math.sin(t * Math.PI) * 0.003;
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

/**
 * Calculate bearing between two coordinates (0-360 degrees).
 */
export function calculateBearing(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const p1 = point([from.lng, from.lat]);
  const p2 = point([to.lng, to.lat]);
  const b = bearing(p1, p2);
  // Convert from -180..180 to 0..360
  return (b + 360) % 360;
}

const FIRST_NAMES = [
  "Marcus",
  "Priya",
  "Carlos",
  "Elena",
  "Jamal",
  "Mei",
  "André",
  "Sofia",
];
const LAST_INITIALS = ["R", "K", "L", "M", "T", "S", "W", "J"];
const CAR_MODELS = [
  "Tesla Model 3",
  "Toyota Camry",
  "Honda Accord",
  "BMW 3 Series",
  "Hyundai Ioniq 5",
  "Mercedes C-Class",
];
const CAR_COLORS = [
  "Black",
  "White",
  "Silver",
  "Midnight Blue",
  "Pearl White",
  "Space Gray",
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a random fake driver profile.
 */
export function generateDriverInfo(): DriverInfo {
  const letters = "ABCDEFGHJKLMNPRSTUVWXYZ";
  const plate = `${letters[Math.floor(Math.random() * letters.length)]}${letters[Math.floor(Math.random() * letters.length)]}${letters[Math.floor(Math.random() * letters.length)]} ${Math.floor(1000 + Math.random() * 9000)}`;

  return {
    name: `${randomItem(FIRST_NAMES)} ${randomItem(LAST_INITIALS)}.`,
    carModel: randomItem(CAR_MODELS),
    carColor: randomItem(CAR_COLORS),
    licensePlate: plate,
    rating: parseFloat((4.7 + Math.random() * 0.3).toFixed(1)),
  };
}

/**
 * Get the camera config for a given ride phase.
 * Designed for dramatic cinematic 3D effect.
 */
export function getCameraForPhase(
  phase: RidePhase,
  pickup: PickupLocation | null,
  dropoff: DropoffLocation | null,
  driver: DriverState | null
): CameraState | null {
  switch (phase) {
    case "idle":
      return {
        center: [-122.4194, 37.7749],
        zoom: 14,
        pitch: 45,
        bearing: -15,
        duration: 2500,
      };

    case "pickup_set":
      if (!pickup) return null;
      return {
        center: [pickup.lng, pickup.lat],
        zoom: 17,
        pitch: 60,
        bearing: -30,
        duration: 2500,
      };

    case "route_set":
      if (!pickup || !dropoff) return null;
      return {
        center: [
          (pickup.lng + dropoff.lng) / 2,
          (pickup.lat + dropoff.lat) / 2,
        ],
        zoom: 14.5,
        pitch: 50,
        bearing: 15,
        duration: 2500,
      };

    case "driver_assigned":
      if (!pickup) return null;
      return {
        center: [pickup.lng, pickup.lat],
        zoom: 16.5,
        pitch: 55,
        bearing: -20,
        duration: 2000,
      };

    case "driver_arriving":
      if (!driver) return null;
      return {
        center: [driver.lng, driver.lat],
        zoom: 17.5,
        pitch: 60,
        bearing: driver.bearing - 30,
        duration: 1500,
      };

    case "in_ride":
      // Chase cam is handled continuously, this is the initial transition
      if (!driver) return null;
      return {
        center: [driver.lng, driver.lat],
        zoom: 17.5,
        pitch: 65,
        bearing: driver.bearing,
        duration: 2000,
      };

    case "completed":
      if (!dropoff) return null;
      return {
        center: [dropoff.lng, dropoff.lat],
        zoom: 16,
        pitch: 45,
        bearing: 20,
        duration: 2500,
      };

    default:
      return null;
  }
}
