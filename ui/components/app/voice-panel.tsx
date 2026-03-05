"use client";

import { useState, useEffect } from "react";
import {
  useAgent,
  useSessionMessages,
  type ReceivedMessage,
} from "@livekit/components-react";
import { AgentAudioVisualizerAura } from "@/components/agents-ui/agent-audio-visualizer-aura";
import { AgentChatTranscript } from "@/components/agents-ui/agent-chat-transcript";
import { AgentControlBar } from "@/components/agents-ui/agent-control-bar";

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
      ? "Listening..."
      : agent.state === "thinking"
        ? "Thinking..."
        : agent.state === "speaking"
          ? "Speaking..."
          : agent.state === "connecting"
            ? "Connecting..."
            : "";

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 flex max-h-[60vh] flex-col rounded-t-3xl border-t border-white/10 bg-black/70 backdrop-blur-xl">
      {/* Drag handle */}
      <div className="flex justify-center py-2">
        <div className="h-1 w-10 rounded-full bg-white/20" />
      </div>

      {/* Visualizer */}
      <div className="flex flex-col items-center gap-1 px-4 pb-2">
        <div className="h-24 w-24">
          <AgentAudioVisualizerAura
            size="md"
            state={agent.state}
            color="#1FD5F9"
            colorShift={0.1}
            themeMode="dark"
            audioTrack={agent.microphoneTrack}
          />
        </div>
        {stateLabel && (
          <span className="text-xs text-zinc-500">{stateLabel}</span>
        )}
      </div>

      {/* Voice pills */}
      <div className="flex justify-center gap-2 px-4 pb-2">
        {VOICES.map((v) => (
          <div
            key={v.id}
            className={`flex flex-col items-center rounded-lg border px-3 py-1.5 text-center transition-all ${
              activeVoice === v.id
                ? "border-white/15 bg-white/8 opacity-100"
                : "border-white/5 bg-white/3 opacity-45"
            }`}
          >
            <span className="text-xs font-semibold text-white">
              {v.label}
            </span>
            <span className="text-[10px] text-zinc-500">{v.desc}</span>
          </div>
        ))}
      </div>

      {/* Transcript */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <AgentChatTranscript
          agentState={agent.state}
          messages={messages}
          className="max-h-40"
        />
      </div>

      {/* Controls */}
      <div className="px-4 pb-6 pt-2">
        <AgentControlBar
          variant="default"
          controls={{
            microphone: true,
            camera: false,
            screenShare: false,
            chat: false,
            leave: true,
          }}
          onDisconnect={onDisconnect}
        />
      </div>
    </div>
  );
}
