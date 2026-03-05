"use client";

import { useRef, useEffect, useMemo, useCallback } from "react";
import Map, {
  Marker,
  Source,
  Layer,
  type MapRef,
} from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { RideState, RidePhase } from "@/lib/ride-types";
import { generateRouteGeoJson, getCameraForPhase } from "@/lib/map-utils";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const INITIAL_VIEW = {
  longitude: -122.4194,
  latitude: 37.7749,
  zoom: 13,
  pitch: 0,
  bearing: 0,
};

interface MapViewProps {
  rideState: RideState;
  dimmed?: boolean;
}

export function MapView({ rideState, dimmed }: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const { pickup, dropoff, driver, phase } = rideState;
  const prevPhaseRef = useRef<RidePhase>("idle");
  const mapLoadedRef = useRef(false);

  const routeGeoJson = useMemo(() => {
    if (pickup && dropoff) {
      return generateRouteGeoJson(pickup, dropoff);
    }
    return null;
  }, [pickup, dropoff]);

  // Configure 3D buildings and dusk lighting on map load
  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    mapLoadedRef.current = true;

    // Set dusk lighting for dramatic dark look
    try {
      map.setConfigProperty("basemap", "lightPreset", "dusk");
    } catch {
      // Fallback if config properties not supported
    }
  }, []);

  // Cinematic camera transitions on phase change
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoadedRef.current) return;
    if (phase === prevPhaseRef.current) return;

    prevPhaseRef.current = phase;

    const cam = getCameraForPhase(phase, pickup, dropoff, driver);
    if (!cam) return;

    if (phase === "route_set" && pickup && dropoff) {
      // Fit bounds for route overview
      const lngs = [pickup.lng, dropoff.lng];
      const lats = [pickup.lat, dropoff.lat];
      map.fitBounds(
        [
          [Math.min(...lngs) - 0.005, Math.min(...lats) - 0.005],
          [Math.max(...lngs) + 0.005, Math.max(...lats) + 0.005],
        ],
        {
          padding: { top: 120, bottom: 120, left: 60, right: 60 },
          pitch: cam.pitch,
          bearing: cam.bearing,
          duration: cam.duration,
        }
      );
    } else {
      map.flyTo({
        center: cam.center,
        zoom: cam.zoom,
        pitch: cam.pitch,
        bearing: cam.bearing,
        duration: cam.duration,
        essential: true,
      });
    }
  }, [phase, pickup, dropoff, driver]);

  // Chase cam — continuously track the car during in_ride
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoadedRef.current) return;
    if (phase !== "in_ride" || !driver) return;

    map.easeTo({
      center: [driver.lng, driver.lat],
      bearing: driver.bearing,
      pitch: 60,
      zoom: 17,
      duration: 300,
    });
  }, [phase, driver?.lat, driver?.lng, driver?.bearing]);

  return (
    <div
      className="absolute inset-0"
      style={{ opacity: dimmed ? 0.4 : 1, transition: "opacity 0.5s" }}
    >
      <Map
        ref={mapRef}
        initialViewState={INITIAL_VIEW}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/standard"
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
        antialias={true}
        onLoad={handleMapLoad}
        maxPitch={85}
      >
        {/* Pickup marker — green pulsing dot */}
        {pickup && (
          <Marker
            longitude={pickup.lng}
            latitude={pickup.lat}
            anchor="center"
          >
            <div className="relative flex items-center justify-center">
              <div className="pickup-pulse absolute h-8 w-8 rounded-full bg-emerald-400/40" />
              <div className="h-4 w-4 rounded-full border-2 border-white bg-emerald-400 shadow-lg shadow-emerald-400/50" />
            </div>
          </Marker>
        )}

        {/* Dropoff marker — red pin with glow */}
        {dropoff && (
          <Marker
            longitude={dropoff.lng}
            latitude={dropoff.lat}
            anchor="bottom"
          >
            <div className="flex flex-col items-center">
              <div className="h-6 w-6 rounded-full border-2 border-white bg-red-500 shadow-lg shadow-red-500/50" />
              <div className="h-3 w-0.5 bg-white/60" />
            </div>
          </Marker>
        )}

        {/* Car marker — top-down car SVG with rotation */}
        {driver && driver.status !== "completed" && (
          <Marker
            longitude={driver.lng}
            latitude={driver.lat}
            anchor="center"
          >
            <div
              className="car-marker car-glow flex items-center justify-center rounded-full"
              style={{
                transform: `rotate(${driver.bearing}deg)`,
                width: 40,
                height: 40,
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Car body (top-down view, pointing up) */}
                <rect
                  x="9"
                  y="4"
                  width="14"
                  height="24"
                  rx="5"
                  fill="#1FD5F9"
                />
                {/* Windshield */}
                <rect
                  x="11"
                  y="6"
                  width="10"
                  height="6"
                  rx="2"
                  fill="#0D9BBD"
                />
                {/* Rear window */}
                <rect
                  x="11"
                  y="20"
                  width="10"
                  height="5"
                  rx="2"
                  fill="#0D9BBD"
                />
                {/* Left mirror */}
                <rect
                  x="6"
                  y="10"
                  width="3"
                  height="4"
                  rx="1.5"
                  fill="#1FD5F9"
                />
                {/* Right mirror */}
                <rect
                  x="23"
                  y="10"
                  width="3"
                  height="4"
                  rx="1.5"
                  fill="#1FD5F9"
                />
                {/* Headlights */}
                <circle cx="12" cy="5" r="1.5" fill="#FFF" opacity="0.9" />
                <circle cx="20" cy="5" r="1.5" fill="#FFF" opacity="0.9" />
                {/* Taillights */}
                <circle cx="12" cy="27" r="1.5" fill="#FF4444" opacity="0.8" />
                <circle cx="20" cy="27" r="1.5" fill="#FF4444" opacity="0.8" />
              </svg>
            </div>
          </Marker>
        )}

        {/* Route glow — 3 overlapping layers */}
        {routeGeoJson && (
          <Source
            id="route"
            type="geojson"
            data={routeGeoJson}
            lineMetrics={true}
          >
            {/* Outer glow */}
            <Layer
              id="route-glow-outer"
              type="line"
              paint={{
                "line-color": "#1FD5F9",
                "line-width": 14,
                "line-opacity": 0.15,
                "line-blur": 8,
              }}
            />
            {/* Core line */}
            <Layer
              id="route-glow-core"
              type="line"
              paint={{
                "line-color": "#1FD5F9",
                "line-width": 5,
                "line-opacity": 0.6,
                "line-blur": 1,
              }}
            />
            {/* Bright highlight */}
            <Layer
              id="route-highlight"
              type="line"
              paint={{
                "line-color": "#FFFFFF",
                "line-width": 1.5,
                "line-opacity": 0.8,
              }}
            />
          </Source>
        )}
      </Map>
    </div>
  );
}
