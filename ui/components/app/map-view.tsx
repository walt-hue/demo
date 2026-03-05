"use client";

import { useRef, useEffect, useCallback } from "react";
import Map, {
  Marker,
  Source,
  Layer,
  type MapRef,
} from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { RideState, RidePhase } from "@/lib/ride-types";
import { getCameraForPhase, renderCarIcon } from "@/lib/map-utils";

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
  const { pickup, dropoff, driver, phase, routeGeoJson } = rideState;
  const prevPhaseRef = useRef<RidePhase>("idle");
  const mapLoadedRef = useRef(false);
  const carImageAddedRef = useRef(false);

  // GeoJSON for the car symbol layer
  const carGeoJson: GeoJSON.Feature | null =
    driver && driver.status !== "completed"
      ? {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [driver.lng, driver.lat],
          },
          properties: {
            bearing: driver.bearing,
          },
        }
      : null;

  // Configure 3D buildings, night lighting, fog, and add car icon
  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    mapLoadedRef.current = true;

    try {
      map.setConfigProperty("basemap", "lightPreset", "night");
      map.setConfigProperty("basemap", "showPointOfInterestLabels", false);
      map.setConfigProperty("basemap", "showTransitLabels", false);
    } catch {
      // Fallback for older Mapbox versions
    }

    // Atmospheric fog
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

    // Render and add car icon image for symbol layer
    if (!carImageAddedRef.current) {
      try {
        const imageData = renderCarIcon(128);
        map.addImage("car-icon", imageData, { sdf: false });
        carImageAddedRef.current = true;
      } catch {
        // Image already exists or canvas not available
      }
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
              <div className="pickup-pulse absolute h-16 w-16 rounded-full border-2 border-emerald-400/60" />
              <div
                className="pickup-pulse absolute h-12 w-12 rounded-full bg-emerald-400/20"
                style={{ animationDelay: "0.5s" }}
              />
              <div className="absolute h-8 w-8 rounded-full bg-emerald-400/30 blur-md" />
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
              <div className="absolute -top-1 h-10 w-10 rounded-full bg-red-500/25 blur-lg" />
              <div className="relative h-8 w-8 rounded-full border-[3px] border-white bg-red-500 shadow-[0_0_20px_6px_rgba(239,68,68,0.4)]">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-white/80" />
                </div>
              </div>
              <div className="h-4 w-1 rounded-b-full bg-gradient-to-b from-white/80 to-white/20" />
            </div>
          </Marker>
        )}

        {/* ═══ CAR — WebGL symbol layer ═══ */}
        {carGeoJson && (
          <Source id="car" type="geojson" data={carGeoJson}>
            <Layer
              id="car-layer"
              type="symbol"
              layout={{
                "icon-image": "car-icon",
                "icon-size": 0.5,
                "icon-rotate": ["get", "bearing"],
                "icon-rotation-alignment": "map",
                "icon-pitch-alignment": "map",
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
              }}
            />
          </Source>
        )}

        {/* ═══ ROUTE GLOW — 4 overlapping layers ═══ */}
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
