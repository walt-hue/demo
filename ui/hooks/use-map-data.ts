"use client";

import { useDataChannel } from "@livekit/components-react";
import type { MapUpdateMessage } from "@/lib/ride-types";

export function useMapData(
  onMapMessage: (msg: MapUpdateMessage) => void
) {
  useDataChannel("map_update", (msg) => {
    try {
      const text = new TextDecoder().decode(msg.payload);
      const parsed = JSON.parse(text) as MapUpdateMessage;
      if (parsed.action) {
        onMapMessage(parsed);
      }
    } catch {
      // Ignore non-JSON messages
    }
  });
}
