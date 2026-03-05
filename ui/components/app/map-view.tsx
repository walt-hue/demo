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

  // Configure 3D buildings, night lighting, fog, and hide POI labels
  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    mapLoadedRef.current = true;

    try {
      // Night preset for maximum 3D building contrast
      map.setConfigProperty("basemap", "lightPreset", "night");
      // Hide POI labels to declutter
      map.setConfigProperty("basemap", "showPointOfInterestLabels", false);
      map.setConfigProperty("basemap", "showTransitLabels", false);
    } catch {
      // Fallback for older Mapbox versions
    }

    // Atmospheric fog for cinematic depth
    try {
      map.setFog({
        color: "rgb(10, 10, 30)",
        "high-color": "rgb(20, 20, 60)",
        "horizon-blend": 0.08,
        "space-color": "rgb(5, 5, 15)",
        "star-intensity": 0.4,
      });
    } catch {
      // Fog not supported
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
          [Math.min(...lngs) - 0.008, Math.min(...lats) - 0.008],
          [Math.max(...lngs) + 0.008, Math.max(...lats) + 0.008],
        ],
        {
          padding: { top: 140, bottom: 140, left: 80, right: 80 },
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
      pitch: 65,
      zoom: 17.5,
      duration: 350,
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
        {/* ═══ PICKUP MARKER ═══ */}
        {pickup && (
          <Marker
            longitude={pickup.lng}
            latitude={pickup.lat}
            anchor="center"
          >
            <div className="relative flex items-center justify-center">
              {/* Outer pulse ring */}
              <div className="pickup-pulse absolute h-16 w-16 rounded-full border-2 border-emerald-400/60" />
              {/* Middle pulse ring */}
              <div
                className="pickup-pulse absolute h-12 w-12 rounded-full bg-emerald-400/20"
                style={{ animationDelay: "0.5s" }}
              />
              {/* Glow halo */}
              <div className="absolute h-8 w-8 rounded-full bg-emerald-400/30 blur-md" />
              {/* Core dot */}
              <div className="relative h-5 w-5 rounded-full border-[3px] border-white bg-emerald-400 shadow-[0_0_16px_4px_rgba(52,211,153,0.5)]" />
            </div>
          </Marker>
        )}

        {/* ═══ DROPOFF MARKER ═══ */}
        {dropoff && (
          <Marker
            longitude={dropoff.lng}
            latitude={dropoff.lat}
            anchor="bottom"
          >
            <div className="flex flex-col items-center">
              {/* Glow behind */}
              <div className="absolute -top-1 h-10 w-10 rounded-full bg-red-500/25 blur-lg" />
              {/* Pin head */}
              <div className="relative h-8 w-8 rounded-full border-[3px] border-white bg-red-500 shadow-[0_0_20px_6px_rgba(239,68,68,0.4)]">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-white/80" />
                </div>
              </div>
              {/* Pin stem */}
              <div className="h-4 w-1 rounded-b-full bg-gradient-to-b from-white/80 to-white/20" />
            </div>
          </Marker>
        )}

        {/* ═══ CAR MARKER ═══ */}
        {driver && driver.status !== "completed" && (
          <Marker
            longitude={driver.lng}
            latitude={driver.lat}
            anchor="center"
          >
            <div
              className="car-marker relative flex items-center justify-center"
              style={{
                transform: `rotate(${driver.bearing}deg)`,
                width: 64,
                height: 64,
              }}
            >
              {/* Large glow halo */}
              <div className="car-glow absolute inset-0 rounded-full bg-cyan-400/10 blur-xl" />
              {/* Medium glow */}
              <div className="absolute inset-2 rounded-full bg-cyan-400/15 blur-md" />

              {/* Car SVG — larger, more detailed */}
              <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="relative drop-shadow-[0_0_12px_rgba(31,213,249,0.6)]"
              >
                {/* Shadow under car */}
                <ellipse
                  cx="24"
                  cy="24"
                  rx="14"
                  ry="18"
                  fill="black"
                  opacity="0.3"
                />
                {/* Car body */}
                <rect
                  x="12"
                  y="4"
                  width="24"
                  height="40"
                  rx="8"
                  fill="#1FD5F9"
                />
                {/* Body highlight */}
                <rect
                  x="14"
                  y="4"
                  width="10"
                  height="40"
                  rx="6"
                  fill="#4DE4FF"
                  opacity="0.3"
                />
                {/* Windshield */}
                <rect
                  x="15"
                  y="8"
                  width="18"
                  height="10"
                  rx="4"
                  fill="#0A7A99"
                />
                {/* Windshield reflection */}
                <rect
                  x="17"
                  y="9"
                  width="8"
                  height="5"
                  rx="2"
                  fill="#1FD5F9"
                  opacity="0.3"
                />
                {/* Rear window */}
                <rect
                  x="15"
                  y="30"
                  width="18"
                  height="9"
                  rx="4"
                  fill="#0A7A99"
                />
                {/* Left wheel well */}
                <rect
                  x="8"
                  y="12"
                  width="5"
                  height="8"
                  rx="2.5"
                  fill="#0D9BBD"
                />
                {/* Right wheel well */}
                <rect
                  x="35"
                  y="12"
                  width="5"
                  height="8"
                  rx="2.5"
                  fill="#0D9BBD"
                />
                {/* Left rear wheel */}
                <rect
                  x="8"
                  y="28"
                  width="5"
                  height="8"
                  rx="2.5"
                  fill="#0D9BBD"
                />
                {/* Right rear wheel */}
                <rect
                  x="35"
                  y="28"
                  width="5"
                  height="8"
                  rx="2.5"
                  fill="#0D9BBD"
                />
                {/* Headlights */}
                <circle cx="17" cy="6" r="2.5" fill="#FFFFFF" />
                <circle cx="31" cy="6" r="2.5" fill="#FFFFFF" />
                {/* Headlight glow */}
                <circle
                  cx="17"
                  cy="6"
                  r="4"
                  fill="#FFFFFF"
                  opacity="0.15"
                />
                <circle
                  cx="31"
                  cy="6"
                  r="4"
                  fill="#FFFFFF"
                  opacity="0.15"
                />
                {/* Taillights */}
                <rect
                  x="14"
                  y="41"
                  width="6"
                  height="3"
                  rx="1.5"
                  fill="#FF3333"
                />
                <rect
                  x="28"
                  y="41"
                  width="6"
                  height="3"
                  rx="1.5"
                  fill="#FF3333"
                />
                {/* Taillight glow */}
                <rect
                  x="13"
                  y="40"
                  width="8"
                  height="5"
                  rx="2"
                  fill="#FF3333"
                  opacity="0.2"
                />
                <rect
                  x="27"
                  y="40"
                  width="8"
                  height="5"
                  rx="2"
                  fill="#FF3333"
                  opacity="0.2"
                />
                {/* Roof detail */}
                <rect
                  x="18"
                  y="20"
                  width="12"
                  height="8"
                  rx="3"
                  fill="#15B8D6"
                />
              </svg>
            </div>
          </Marker>
        )}

        {/* ═══ ROUTE GLOW — 3 overlapping layers ═══ */}
        {routeGeoJson && (
          <Source
            id="route"
            type="geojson"
            data={routeGeoJson}
            lineMetrics={true}
          >
            {/* Wide outer glow */}
            <Layer
              id="route-glow-outer"
              type="line"
              paint={{
                "line-color": "#1FD5F9",
                "line-width": 20,
                "line-opacity": 0.12,
                "line-blur": 12,
              }}
            />
            {/* Medium glow */}
            <Layer
              id="route-glow-mid"
              type="line"
              paint={{
                "line-color": "#1FD5F9",
                "line-width": 10,
                "line-opacity": 0.25,
                "line-blur": 4,
              }}
            />
            {/* Core line */}
            <Layer
              id="route-glow-core"
              type="line"
              paint={{
                "line-color": "#1FD5F9",
                "line-width": 4,
                "line-opacity": 0.8,
              }}
            />
            {/* Bright highlight center */}
            <Layer
              id="route-highlight"
              type="line"
              paint={{
                "line-color": "#FFFFFF",
                "line-width": 1.5,
                "line-opacity": 0.6,
              }}
            />
          </Source>
        )}
      </Map>
    </div>
  );
}
