"use client";

import { useState, useRef } from "react";
import { TokenSource, type TokenSourceConfigurable } from "livekit-client";
import { MapView } from "@/components/app/map-view";
import { LandingView } from "@/components/app/landing-view";
import { SessionWrapper } from "@/components/app/session-wrapper";
import { useRideState } from "@/hooks/use-ride-state";

const LIVEKIT_URL =
  process.env.NEXT_PUBLIC_LIVEKIT_URL || "wss://rime-lx56n42z.livekit.cloud";

export default function Home() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const { rideState, handleMapMessage, dispatch } = useRideState();

  const tokenSource = useRef(
    TokenSource.custom(async (options) => {
      const params = new URLSearchParams();
      if (options.roomName) params.set("room", options.roomName);
      if (options.participantName)
        params.set("identity", options.participantName);
      const res = await fetch(`/api/token?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to get token");
      }
      const { token, roomName } = await res.json();
      return {
        serverUrl: LIVEKIT_URL,
        participantToken: token,
        roomName,
      };
    })
  ).current;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      {/* Map is always visible as background */}
      {!isConnected && <MapView rideState={rideState} dimmed />}

      {!isConnected ? (
        <LandingView
          isConnecting={isConnecting}
          onConnect={() => {
            setIsConnecting(true);
            setIsConnected(true);
          }}
        />
      ) : (
        <SessionWrapper
          tokenSource={tokenSource}
          rideState={rideState}
          onMapMessage={handleMapMessage}
          onDisconnect={() => {
            setIsConnected(false);
            setIsConnecting(false);
            dispatch({ type: "RESET" });
          }}
        />
      )}
    </div>
  );
}
