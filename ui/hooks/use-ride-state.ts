"use client";

import { useReducer, useCallback, useRef, useEffect } from "react";
import type {
  RideState,
  RidePhase,
  DriverState,
  MapUpdateMessage,
} from "@/lib/ride-types";
import {
  generateRouteGeoJson,
  interpolateAlongRoute,
  easeInOut,
} from "@/lib/map-utils";

type RideAction =
  | {
      type: "SET_PICKUP";
      data: { address: string; lat: number; lng: number };
    }
  | {
      type: "SET_DROPOFF";
      data: { address: string; lat: number; lng: number };
    }
  | {
      type: "UPDATE_DRIVER";
      data: {
        status: string;
        lat: number;
        lng: number;
        eta_minutes: number;
      };
    }
  | { type: "START_RIDE" }
  | { type: "COMPLETE_RIDE" }
  | { type: "UPDATE_DRIVER_POSITION"; lat: number; lng: number }
  | { type: "RESET" };

const initialState: RideState = {
  phase: "idle",
  pickup: null,
  dropoff: null,
  driver: null,
};

function rideReducer(state: RideState, action: RideAction): RideState {
  switch (action.type) {
    case "SET_PICKUP":
      return { ...state, pickup: action.data, phase: "pickup_set" };
    case "SET_DROPOFF":
      return {
        ...state,
        dropoff: action.data,
        phase: state.pickup ? "route_set" : state.phase,
      };
    case "UPDATE_DRIVER": {
      const driverStatus = action.data.status as DriverState["status"];
      let phase: RidePhase = state.phase;
      if (driverStatus === "en_route") phase = "driver_assigned";
      else if (driverStatus === "arriving") phase = "driver_arriving";
      else if (driverStatus === "waiting") phase = "driver_arriving";
      return {
        ...state,
        driver: {
          status: driverStatus,
          lat: action.data.lat,
          lng: action.data.lng,
          eta_minutes: action.data.eta_minutes,
        },
        phase,
      };
    }
    case "START_RIDE":
      return {
        ...state,
        phase: "in_ride",
        driver: state.driver
          ? { ...state.driver, status: "in_ride" }
          : null,
      };
    case "COMPLETE_RIDE":
      return {
        ...state,
        phase: "completed",
        driver: state.driver
          ? { ...state.driver, status: "completed" }
          : null,
      };
    case "UPDATE_DRIVER_POSITION":
      return state.driver
        ? {
            ...state,
            driver: { ...state.driver, lat: action.lat, lng: action.lng },
          }
        : state;
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

export function useRideState() {
  const [state, dispatch] = useReducer(rideReducer, initialState);
  const animFrameRef = useRef<number>(0);

  const handleMapMessage = useCallback((msg: MapUpdateMessage) => {
    switch (msg.action) {
      case "set_pickup":
        dispatch({
          type: "SET_PICKUP",
          data: msg.data as { address: string; lat: number; lng: number },
        });
        break;
      case "set_dropoff":
        dispatch({
          type: "SET_DROPOFF",
          data: msg.data as { address: string; lat: number; lng: number },
        });
        break;
      case "update_driver":
        dispatch({
          type: "UPDATE_DRIVER",
          data: msg.data as {
            status: string;
            lat: number;
            lng: number;
            eta_minutes: number;
          },
        });
        break;
      case "start_ride":
        dispatch({ type: "START_RIDE" });
        break;
      case "complete_ride":
        dispatch({ type: "COMPLETE_RIDE" });
        break;
    }
  }, []);

  // Animate driver along route when ride is in progress
  useEffect(() => {
    if (state.phase !== "in_ride" || !state.pickup || !state.dropoff) return;

    const route = generateRouteGeoJson(state.pickup, state.dropoff);
    const coords = (
      route.features[0].geometry as GeoJSON.LineString
    ).coordinates as [number, number][];

    const RIDE_DURATION_MS = 30_000;
    const startTime = Date.now();

    function animate() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / RIDE_DURATION_MS, 1);
      const eased = easeInOut(progress);

      const pos = interpolateAlongRoute(coords, eased);
      dispatch({
        type: "UPDATE_DRIVER_POSITION",
        lat: pos.lat,
        lng: pos.lng,
      });

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    }

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [state.phase, state.pickup, state.dropoff]);

  return { rideState: state, handleMapMessage, dispatch };
}
