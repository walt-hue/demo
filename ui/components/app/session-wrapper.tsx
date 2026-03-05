"use client";

import { useRef, useEffect, useCallback } from "react";
import { useSession } from "@livekit/components-react";
import type { TokenSourceConfigurable } from "livekit-client";
import { AgentSessionProvider } from "@/components/agents-ui/agent-session-provider";
import { MapView } from "@/components/app/map-view";
import { RideStatusCard } from "@/components/app/ride-status-card";
import { VoicePanel } from "@/components/app/voice-panel";
import { useMapData } from "@/hooks/use-map-data";
import type { RideState, MapUpdateMessage } from "@/lib/ride-types";

interface SessionWrapperProps {
  tokenSource: TokenSourceConfigurable;
  rideState: RideState;
  onMapMessage: (msg: MapUpdateMessage) => void;
  onDisconnect: () => void;
}

export function SessionWrapper({
  tokenSource,
  rideState,
  onMapMessage,
  onDisconnect,
}: SessionWrapperProps) {
  const roomName = useRef(`voice-${Date.now()}`).current;
  const session = useSession(tokenSource, { roomName });
  const started = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      session.start();
    }
    return () => {
      sessionRef.current.end();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDisconnect = useCallback(() => {
    sessionRef.current.end();
    onDisconnect();
  }, [onDisconnect]);

  return (
    <AgentSessionProvider session={session}>
      <MapDataBridge onMapMessage={onMapMessage} />
      <MapView rideState={rideState} />
      <RideStatusCard rideState={rideState} />
      <VoicePanel onDisconnect={handleDisconnect} />
    </AgentSessionProvider>
  );
}

/** Bridge component that uses useDataChannel (requires RoomContext from SessionProvider) */
function MapDataBridge({
  onMapMessage,
}: {
  onMapMessage: (msg: MapUpdateMessage) => void;
}) {
  useMapData(onMapMessage);
  return null;
}
