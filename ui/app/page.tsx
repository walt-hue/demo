"use client";

import {
  BarVisualizer,
  RoomAudioRenderer,
  SessionProvider,
  useAgent,
  useSession,
} from "@livekit/components-react";
import { TokenSource, type TokenSourceConfigurable } from "livekit-client";
import { useRef, useState, useCallback, useEffect } from "react";
import "@livekit/components-styles";

const LIVEKIT_URL =
  process.env.NEXT_PUBLIC_LIVEKIT_URL || "wss://rime-lx56n42z.livekit.cloud";

function AgentVoiceView({ onDisconnect }: { onDisconnect: () => void }) {
  const agent = useAgent();

  const stateLabel =
    agent.state === "listening"
      ? "Listening..."
      : agent.state === "thinking"
        ? "Thinking..."
        : agent.state === "speaking"
          ? "Speaking..."
          : agent.state === "connecting"
            ? "Connecting..."
            : agent.state;

  return (
    <div className="voice-view">
      <div className="visualizer-container">
        {agent.microphoneTrack ? (
          <BarVisualizer
            track={agent.microphoneTrack}
            state={agent.state}
            barCount={5}
            options={{ minHeight: 24 }}
          />
        ) : (
          <div className="waiting-indicator">
            <div className="pulse" />
          </div>
        )}
      </div>

      <p className="agent-state">{stateLabel}</p>

      <button className="disconnect-btn" onClick={onDisconnect}>
        End Call
      </button>
    </div>
  );
}

function ActiveSession({ onDisconnect }: { onDisconnect: () => void }) {
  const [micEnabled, setMicEnabled] = useState(true);

  return (
    <>
      <AgentVoiceView onDisconnect={onDisconnect} />
      <div className="controls">
        <button
          className={`mic-btn ${!micEnabled ? "muted" : ""}`}
          onClick={() => setMicEnabled(!micEnabled)}
        >
          {micEnabled ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="2" x2="22" y1="2" y2="22" />
              <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
              <path d="M5 10v2a7 7 0 0 0 12 5" />
              <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          )}
        </button>
      </div>
      <RoomAudioRenderer />
    </>
  );
}

function ConnectedRoom({ onDisconnect }: { onDisconnect: () => void }) {
  return (
    <div data-lk-theme="default" className="room-container">
      <ActiveSession onDisconnect={onDisconnect} />
    </div>
  );
}

export default function Home() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

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
    <div className="app">
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
          onDisconnect={() => {
            setIsConnected(false);
            setIsConnecting(false);
          }}
        />
      )}
    </div>
  );
}

function LandingView({
  isConnecting,
  onConnect,
}: {
  isConnecting: boolean;
  onConnect: () => void;
}) {
  return (
    <div className="landing">
      <div className="landing-content">
        <div className="logo-area">
          <div className="logo-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </div>
        </div>
        <h1>Voice Agent Demo</h1>
        <p className="subtitle">
          Talk to an AI-powered voice agent. Click below to start a conversation.
        </p>
        <button
          className="connect-btn"
          onClick={onConnect}
          disabled={isConnecting}
        >
          {isConnecting ? "Connecting..." : "Start Conversation"}
        </button>
      </div>
    </div>
  );
}

function SessionWrapper({
  tokenSource,
  onDisconnect,
}: {
  tokenSource: TokenSourceConfigurable;
  onDisconnect: () => void;
}) {
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
    <SessionProvider session={session}>
      <ConnectedRoom onDisconnect={handleDisconnect} />
    </SessionProvider>
  );
}
