"use client";

import type { RideState } from "@/lib/ride-types";

interface RideStatusCardProps {
  rideState: RideState;
}

export function RideStatusCard({ rideState }: RideStatusCardProps) {
  const { phase, pickup, dropoff, driver } = rideState;

  if (phase === "idle") return null;

  let content: React.ReactNode;

  switch (phase) {
    case "pickup_set":
      content = (
        <>
          <div className="text-xs font-medium uppercase tracking-wider text-green-400">
            Pickup
          </div>
          <div className="text-sm text-white">{pickup?.address}</div>
        </>
      );
      break;
    case "route_set":
      content = (
        <>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs text-zinc-400">{pickup?.address}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-xs text-zinc-400">{dropoff?.address}</span>
          </div>
          <div className="mt-1 text-sm text-white">Finding your driver...</div>
        </>
      );
      break;
    case "driver_assigned":
      content = (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">
              Driver en route
            </span>
            <span className="text-sm font-bold text-blue-400">
              {driver?.eta_minutes} min
            </span>
          </div>
          <div className="text-xs text-zinc-400">{pickup?.address}</div>
        </>
      );
      break;
    case "driver_arriving":
      content = (
        <div className="text-sm font-medium text-green-400">
          Driver arriving now
        </div>
      );
      break;
    case "in_ride":
      content = (
        <>
          <div className="text-xs font-medium uppercase tracking-wider text-blue-400">
            In ride
          </div>
          <div className="text-sm text-white">
            Heading to {dropoff?.address}
          </div>
        </>
      );
      break;
    case "completed":
      content = (
        <>
          <div className="text-xs font-medium uppercase tracking-wider text-green-400">
            Arrived
          </div>
          <div className="text-sm text-white">
            You&apos;ve arrived at {dropoff?.address}
          </div>
        </>
      );
      break;
  }

  return (
    <div className="absolute left-4 right-4 top-4 z-20 rounded-2xl border border-white/10 bg-black/70 p-4 backdrop-blur-xl">
      {content}
    </div>
  );
}
