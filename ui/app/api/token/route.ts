import { config } from "dotenv";
import path from "path";
import { AccessToken } from "livekit-server-sdk";
import { RoomAgentDispatch, RoomConfiguration } from "@livekit/protocol";
import { NextRequest, NextResponse } from "next/server";

// Load from ui/.env.local (Next does this) or parent .env.local so one file works for agent + UI
if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
  const parentEnv = path.join(process.cwd(), "..", ".env.local");
  config({ path: parentEnv });
}

const AGENT_NAME = process.env.LIVEKIT_AGENT_NAME ?? "CA_aGnmHJiQijRD";

export async function GET(request: NextRequest) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const roomName = searchParams.get("room") ?? `room-${Date.now()}`;
  const identity = searchParams.get("identity") ?? `user-${Math.random().toString(36).slice(2, 10)}`;

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name: identity,
  });

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  // Dispatch the voice agent to this room when the user joins
  token.roomConfig = new RoomConfiguration({
    agents: [
      new RoomAgentDispatch({
        agentName: AGENT_NAME,
        metadata: JSON.stringify({}),
      }),
    ],
  });

  const jwt = await token.toJwt();
  return NextResponse.json({ token: jwt, roomName, identity });
}
