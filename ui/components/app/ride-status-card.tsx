"use client";

import { useState, useEffect } from "react";
import type { RideState } from "@/lib/ride-types";

interface RideStatusCardProps {
  rideState: RideState;
}

/** Live countdown timer (mm:ss) */
function ETACountdown({ minutes }: { minutes: number }) {
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60);

  useEffect(() => {
    setSecondsLeft(minutes * 60);
  }, [minutes]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <span className="tabular-nums text-lg font-bold text-cyan-400">
      {mins}:{secs.toString().padStart(2, "0")}
    </span>
  );
}

export function RideStatusCard({ rideState }: RideStatusCardProps) {
  const { phase, pickup, dropoff, driver, driverInfo } = rideState;

  if (phase === "idle") return null;

  let content: React.ReactNode;

  switch (phase) {
    case "pickup_set":
      content = (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-emerald-400">
              Pickup Location
            </div>
            <div className="text-sm text-white">{pickup?.address}</div>
          </div>
        </div>
      );
      break;

    case "route_set":
      content = (
        <>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-0.5">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <div className="h-4 w-px bg-white/20" />
              <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-zinc-300">{pickup?.address}</span>
              <span className="text-xs text-zinc-300">{dropoff?.address}</span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-cyan-400" />
            </div>
            <span className="text-xs text-zinc-400">Finding driver...</span>
          </div>
        </>
      );
      break;

    case "driver_assigned":
    case "driver_arriving":
      content = (
        <>
          {/* Driver info row */}
          {driverInfo && (
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-sm font-bold text-white shadow-lg shadow-cyan-500/20">
                {driverInfo.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">
                    {driverInfo.name}
                  </span>
                  <span className="text-xs text-amber-400">
                    ★ {driverInfo.rating}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400">
                  {driverInfo.carColor} {driverInfo.carModel}
                </div>
              </div>
              {/* ETA */}
              {driver && driver.eta_minutes > 0 && (
                <div className="text-right">
                  <ETACountdown minutes={driver.eta_minutes} />
                  <div className="text-[10px] text-zinc-500">ETA</div>
                </div>
              )}
            </div>
          )}

          {/* License plate */}
          {driverInfo && (
            <div className="mt-2 flex items-center justify-between">
              <div className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1">
                <span className="font-mono text-xs font-bold tracking-widest text-white">
                  {driverInfo.licensePlate}
                </span>
              </div>
              <span className="text-xs text-zinc-500">
                {phase === "driver_arriving"
                  ? "Arriving now"
                  : "En route to you"}
              </span>
            </div>
          )}
        </>
      );
      break;

    case "in_ride":
      content = (
        <>
          {driverInfo && (
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-xs font-bold text-white">
                {driverInfo.name.charAt(0)}
              </div>
              <span className="text-xs text-zinc-400">
                {driverInfo.name} · {driverInfo.carColor} {driverInfo.carModel}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-0.5">
              <div className="h-2 w-2 rounded-full bg-cyan-400" />
              <div className="h-3 w-px bg-cyan-400/30" />
              <div className="h-2 w-2 rounded-full border border-red-400 bg-transparent" />
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-cyan-400">
                In Transit
              </div>
              <div className="text-sm text-white">{dropoff?.address}</div>
            </div>
          </div>
        </>
      );
      break;

    case "completed":
      content = (
        <div className="text-center">
          <div className="mb-1 text-2xl">🎉</div>
          <div className="text-sm font-medium text-emerald-400">
            You&apos;ve arrived!
          </div>
          <div className="text-xs text-zinc-400">{dropoff?.address}</div>
          {driverInfo && (
            <div className="mt-2 text-[11px] text-zinc-500">
              Thanks for riding with {driverInfo.name}
            </div>
          )}
        </div>
      );
      break;
  }

  return (
    <div className="absolute left-4 right-4 top-4 z-20 rounded-2xl border border-white/10 bg-black/70 p-4 backdrop-blur-xl transition-all duration-500">
      {content}
    </div>
  );
}
