export interface PickupLocation {
  address: string;
  lat: number;
  lng: number;
}

export interface DropoffLocation {
  address: string;
  lat: number;
  lng: number;
}

export interface DriverState {
  status:
    | "searching"
    | "en_route"
    | "arriving"
    | "waiting"
    | "in_ride"
    | "completed";
  lat: number;
  lng: number;
  eta_minutes: number;
  bearing: number;
}

export interface DriverInfo {
  name: string;
  carModel: string;
  carColor: string;
  licensePlate: string;
  rating: number;
}

export interface CameraState {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  duration: number;
}

export type RidePhase =
  | "idle"
  | "pickup_set"
  | "route_set"
  | "driver_assigned"
  | "driver_arriving"
  | "in_ride"
  | "completed";

export interface RideState {
  phase: RidePhase;
  pickup: PickupLocation | null;
  dropoff: DropoffLocation | null;
  driver: DriverState | null;
  driverInfo: DriverInfo | null;
  routeGeoJson: GeoJSON.FeatureCollection | null;
  routePoints: [number, number][] | null;
}

export interface MapUpdateMessage {
  action:
    | "set_pickup"
    | "set_dropoff"
    | "update_driver"
    | "start_ride"
    | "complete_ride";
  data: Record<string, unknown>;
}
