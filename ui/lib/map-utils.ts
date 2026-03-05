import bearing from "@turf/bearing";
import along from "@turf/along";
import length from "@turf/length";
import { point, lineString } from "@turf/helpers";
import type {
  PickupLocation,
  DropoffLocation,
  DriverState,
  DriverInfo,
  CameraState,
  RidePhase,
} from "./ride-types";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

// ═══ Route fetching ═══

/**
 * Fetch a real driving route from the Mapbox Directions API.
 * Falls back to a straight line if the API fails.
 */
export async function fetchRouteGeoJson(
  pickup: PickupLocation,
  dropoff: DropoffLocation
): Promise<GeoJSON.FeatureCollection> {
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.code === "Ok" && data.routes?.length > 0) {
      return {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {
              distance: data.routes[0].distance, // meters
              duration: data.routes[0].duration, // seconds
            },
            geometry: data.routes[0].geometry,
          },
        ],
      };
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback: simple straight line
  return generateFallbackRoute(pickup, dropoff);
}

/**
 * Fallback straight-line route (used when Directions API fails).
 */
function generateFallbackRoute(
  pickup: PickupLocation,
  dropoff: DropoffLocation
): GeoJSON.FeatureCollection {
  const steps = 50;
  const coords: [number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = pickup.lat + (dropoff.lat - pickup.lat) * t;
    const lng = pickup.lng + (dropoff.lng - pickup.lng) * t;
    const offset = Math.sin(t * Math.PI) * 0.003;
    coords.push([lng + offset, lat]);
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: coords },
      },
    ],
  };
}

// ═══ Route interpolation (turf-based, for real road geometry) ═══

/**
 * Pre-compute evenly-spaced points along a route for smooth animation.
 */
export function precomputeRoutePoints(
  routeCoords: [number, number][],
  steps: number = 500
): [number, number][] {
  if (routeCoords.length < 2) return routeCoords;

  const line = lineString(routeCoords);
  const totalDist = length(line, { units: "kilometers" });
  const points: [number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const dist = (i / steps) * totalDist;
    const pt = along(line, dist, { units: "kilometers" });
    points.push(pt.geometry.coordinates as [number, number]);
  }

  return points;
}

/**
 * Interpolate a position along pre-computed route points at a given fraction (0-1).
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

// ═══ Bearing ═══

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
  return (b + 360) % 360;
}

// ═══ Driver info generation ═══

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

// ═══ Camera configs ═══

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

// ═══ Car icon rendering ═══

/**
 * Render a car icon to a canvas ImageData for use with map.addImage().
 * Returns an ImageData object that Mapbox GL can use.
 */
export function renderCarIcon(size: number = 96): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const cx = size / 2;
  const cy = size / 2;
  const scale = size / 96;

  // Outer glow
  const glow = ctx.createRadialGradient(cx, cy, 10 * scale, cx, cy, 44 * scale);
  glow.addColorStop(0, "rgba(31, 213, 249, 0.35)");
  glow.addColorStop(0.6, "rgba(31, 213, 249, 0.1)");
  glow.addColorStop(1, "rgba(31, 213, 249, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, 44 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Car body shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.beginPath();
  ctx.ellipse(cx + 1 * scale, cy + 2 * scale, 16 * scale, 24 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Car body
  ctx.fillStyle = "#1FD5F9";
  ctx.beginPath();
  ctx.roundRect(cx - 14 * scale, cy - 22 * scale, 28 * scale, 44 * scale, 10 * scale);
  ctx.fill();

  // Body highlight (left side)
  ctx.fillStyle = "rgba(77, 228, 255, 0.3)";
  ctx.beginPath();
  ctx.roundRect(cx - 12 * scale, cy - 22 * scale, 12 * scale, 44 * scale, 8 * scale);
  ctx.fill();

  // Windshield
  ctx.fillStyle = "#0A7A99";
  ctx.beginPath();
  ctx.roundRect(cx - 10 * scale, cy - 18 * scale, 20 * scale, 12 * scale, 4 * scale);
  ctx.fill();

  // Rear window
  ctx.fillStyle = "#0A7A99";
  ctx.beginPath();
  ctx.roundRect(cx - 10 * scale, cy + 8 * scale, 20 * scale, 10 * scale, 4 * scale);
  ctx.fill();

  // Wheels (dark)
  ctx.fillStyle = "#0D9BBD";
  const wheelPositions = [
    [-18, -10], [14, -10],  // front wheels
    [-18, 6], [14, 6],      // rear wheels
  ];
  for (const [wx, wy] of wheelPositions) {
    ctx.beginPath();
    ctx.roundRect(
      cx + wx * scale,
      cy + wy * scale,
      5 * scale,
      8 * scale,
      2.5 * scale
    );
    ctx.fill();
  }

  // Headlights (bright white)
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(cx - 7 * scale, cy - 21 * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 7 * scale, cy - 21 * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Headlight glow
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.beginPath();
  ctx.arc(cx - 7 * scale, cy - 21 * scale, 6 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 7 * scale, cy - 21 * scale, 6 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Taillights
  ctx.fillStyle = "#FF3333";
  ctx.beginPath();
  ctx.roundRect(cx - 9 * scale, cy + 18 * scale, 7 * scale, 3 * scale, 1.5 * scale);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx + 2 * scale, cy + 18 * scale, 7 * scale, 3 * scale, 1.5 * scale);
  ctx.fill();

  // Taillight glow
  ctx.fillStyle = "rgba(255, 51, 51, 0.2)";
  ctx.beginPath();
  ctx.roundRect(cx - 11 * scale, cy + 16 * scale, 10 * scale, 7 * scale, 3 * scale);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx + 1 * scale, cy + 16 * scale, 10 * scale, 7 * scale, 3 * scale);
  ctx.fill();

  // Roof detail
  ctx.fillStyle = "#15B8D6";
  ctx.beginPath();
  ctx.roundRect(cx - 7 * scale, cy - 4 * scale, 14 * scale, 10 * scale, 4 * scale);
  ctx.fill();

  return ctx.getImageData(0, 0, size, size);
}
