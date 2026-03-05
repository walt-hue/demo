"use client";

interface LandingViewProps {
  isConnecting: boolean;
  onConnect: () => void;
}

export function LandingView({ isConnecting, onConnect }: LandingViewProps) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 backdrop-blur">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Ride Support
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Talk to an AI-powered ride support agent
          </p>
        </div>
        <button
          onClick={onConnect}
          disabled={isConnecting}
          className="rounded-xl bg-white px-8 py-3.5 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isConnecting ? "Connecting..." : "Start Conversation"}
        </button>
      </div>
    </div>
  );
}
