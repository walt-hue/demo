"use client";

import { useRef, useEffect, useMemo } from "react";
import Map, { Marker, Source, Layer, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RideState } from "@/lib/ride-types";
import { generateRouteGeoJson } from "@/lib/map-utils";

const DARK_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const INITIAL_VIEW = {
  longitude: -122.4194,
  latitude: 37.7749,
  zoom: 13,
};

interface MapViewProps {
  rideState: RideState;
  dimmed?: boolean;
}

export function MapView({ rideState, dimmed }: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const { pickup, dropoff, driver } = rideState;

  const routeGeoJson = useMemo(() => {
    if (pickup && dropoff) {
      return generateRouteGeoJson(pickup, dropoff);
    }
    return null;
  }, [pickup, dropoff]);

  // Fit map bounds when markers change
  useEffect(() => {
    if (!mapRef.current) return;

    const points: [number, number][] = [];
    if (pickup) points.push([pickup.lng, pickup.lat]);
    if (dropoff) points.push([dropoff.lng, dropoff.lat]);
    if (driver) points.push([driver.lng, driver.lat]);

    if (points.length >= 2) {
      const lngs = points.map((p) => p[0]);
      const lats = points.map((p) => p[1]);
      mapRef.current.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 80, duration: 1000 }
      );
    } else if (points.length === 1) {
      mapRef.current.flyTo({
        center: points[0],
        zoom: 15,
        duration: 1000,
      });
    }
  }, [pickup, dropoff, driver?.lat, driver?.lng]);

  return (
    <div
      className="absolute inset-0"
      style={{ opacity: dimmed ? 0.4 : 1, transition: "opacity 0.5s" }}
    >
      <Map
        ref={mapRef}
        initialViewState={INITIAL_VIEW}
        mapStyle={DARK_STYLE}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        {/* Pickup marker */}
        {pickup && (
          <Marker longitude={pickup.lng} latitude={pickup.lat} anchor="center">
            <div className="relative flex items-center justify-center">
              <div className="absolute h-8 w-8 animate-ping rounded-full bg-green-500/30" />
              <div className="h-4 w-4 rounded-full border-2 border-white bg-green-500 shadow-lg" />
            </div>
          </Marker>
        )}

        {/* Dropoff marker */}
        {dropoff && (
          <Marker
            longitude={dropoff.lng}
            latitude={dropoff.lat}
            anchor="bottom"
          >
            <div className="flex flex-col items-center">
              <div className="h-6 w-6 rounded-full border-2 border-white bg-red-500 shadow-lg" />
              <div className="h-2 w-0.5 bg-white/60" />
            </div>
          </Marker>
        )}

        {/* Driver marker */}
        {driver && driver.status !== "completed" && (
          <Marker
            longitude={driver.lng}
            latitude={driver.lat}
            anchor="center"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#000"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
                <path d="M15 18H9" />
                <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
                <circle cx="17" cy="18" r="2" />
                <circle cx="7" cy="18" r="2" />
              </svg>
            </div>
          </Marker>
        )}

        {/* Route line */}
        {routeGeoJson && (
          <Source id="route" type="geojson" data={routeGeoJson}>
            <Layer
              id="route-line"
              type="line"
              paint={{
                "line-color": "#3b82f6",
                "line-width": 4,
                "line-opacity": 0.7,
              }}
            />
          </Source>
        )}
      </Map>
    </div>
  );
}
