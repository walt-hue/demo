"use client";

import { useEffect } from "react";
import { RoomEvent, type Room } from "livekit-client";
import type { MapUpdateMessage } from "@/lib/ride-types";

export function useMapData(
  room: Room | undefined,
  onMapMessage: (msg: MapUpdateMessage) => void
) {
  useEffect(() => {
    if (!room) return;

    const handleData = (
      payload: Uint8Array,
      _participant?: unknown,
      _kind?: unknown,
      topic?: string
    ) => {
      if (topic && topic !== "map_update") return;

      try {
        const text = new TextDecoder().decode(payload);
        const msg = JSON.parse(text) as MapUpdateMessage;
        if (msg.action) {
          onMapMessage(msg);
        }
      } catch {
        // Ignore non-JSON or non-map messages
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room, onMapMessage]);
}
