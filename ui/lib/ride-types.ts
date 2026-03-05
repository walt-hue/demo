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
}

export interface MapUpdateMessage {
  type: "map_update";
  action:
    | "set_pickup"
    | "set_dropoff"
    | "update_driver"
    | "start_ride"
    | "complete_ride";
  data: Record<string, unknown>;
}
