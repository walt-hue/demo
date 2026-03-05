"use client";

import { useState, useEffect } from "react";
import {
  useAgent,
  useSessionMessages,
  type ReceivedMessage,
} from "@livekit/components-react";
import { AgentAudioVisualizerAura } from "@/components/agents-ui/agent-audio-visualizer-aura";
import { AgentChatTranscript } from "@/components/agents-ui/agent-chat-transcript";

const VOICES = [
  { id: "vespera", label: "Vespera", desc: "Warm" },
  { id: "arcade", label: "Arcade", desc: "Energetic" },
  { id: "eliphas", label: "Eliphas", desc: "Calm" },
] as const;

interface VoicePanelProps {
  onDisconnect: () => void;
}

export function VoicePanel({ onDisconnect }: VoicePanelProps) {
  const agent = useAgent();
  const { messages } = useSessionMessages();
  const [activeVoice, setActiveVoice] = useState("vespera");
  const [expanded, setExpanded] = useState(false);

  // Detect voice switches from agent transcript
  useEffect(() => {
    const lastAgentMsg = [...messages]
      .reverse()
      .find((m: ReceivedMessage) => m.type === "agentTranscript");
    if (lastAgentMsg && lastAgentMsg.type === "agentTranscript") {
      const text = lastAgentMsg.message.toLowerCase();
      for (const v of VOICES) {
        if (
          text.includes(`switched to ${v.id}`) ||
          text.includes(`voice switched to ${v.id}`)
        ) {
          setActiveVoice(v.id);
          break;
        }
      }
    }
  }, [messages]);

  const stateLabel =
    agent.state === "listening"
      ? "Listening"
      : agent.state === "thinking"
        ? "Thinking"
        : agent.state === "speaking"
          ? "Speaking"
          : agent.state === "connecting"
            ? "Connecting"
            : "";

  return (
    <div className="absolute bottom-6 right-6 z-30 flex flex-col items-end gap-3">
      {/* Expanded panel */}
      {expanded && (
        <div className="w-80 rounded-2xl border border-white/10 bg-black/80 backdrop-blur-xl">
          {/* Transcript */}
          <div className="max-h-52 overflow-y-auto p-3">
            <AgentChatTranscript
              agentState={agent.state}
              messages={messages}
              className="max-h-48"
            />
          </div>

          {/* Voice pills */}
          <div className="flex justify-center gap-1.5 border-t border-white/5 px-3 py-2">
            {VOICES.map((v) => (
              <div
                key={v.id}
                className={`rounded-md border px-2 py-1 text-center transition-all ${
                  activeVoice === v.id
                    ? "border-white/15 bg-white/8 opacity-100"
                    : "border-white/5 bg-white/3 opacity-45"
                }`}
              >
                <span className="text-[10px] font-medium text-white">
                  {v.label}
                </span>
              </div>
            ))}
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between border-t border-white/5 px-3 py-2">
            <span className="text-[10px] text-zinc-500">
              {stateLabel && `${stateLabel}...`}
            </span>
            <button
              onClick={onDisconnect}
              className="rounded-lg bg-red-500/20 px-3 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/30"
            >
              End
            </button>
          </div>
        </div>
      )}

      {/* Floating orb */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="group relative flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-black/70 shadow-2xl shadow-black/50 backdrop-blur-xl transition-all hover:border-white/20 hover:shadow-cyan-500/10"
      >
        <div className="h-14 w-14">
          <AgentAudioVisualizerAura
            size="sm"
            state={agent.state}
            color="#1FD5F9"
            colorShift={0.1}
            themeMode="dark"
            audioTrack={agent.microphoneTrack}
          />
        </div>

        {/* State dot indicator */}
        <div
          className={`absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-black ${
            agent.state === "speaking"
              ? "bg-cyan-400"
              : agent.state === "listening"
                ? "bg-green-400"
                : agent.state === "thinking"
                  ? "bg-amber-400"
                  : "bg-zinc-500"
          }`}
        />
      </button>
    </div>
  );
}
