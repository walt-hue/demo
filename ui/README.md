# LiveKit Voice Agent UI

Next.js app that connects to your LiveKit Cloud voice agent (Uber support). Users get a browser-based voice UI; the agent is dispatched to the room via token room config.

## Setup

1. Copy env example and fill in your LiveKit Cloud credentials (run from the `ui` folder):

   ```bash
   cd ui
   cp .env.example .env.local
   ```

2. Edit `ui/.env.local` and set:

   - `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` – from [LiveKit Cloud](https://cloud.livekit.io) project settings
   - `NEXT_PUBLIC_LIVEKIT_URL` – your project WebSocket URL (e.g. `wss://your-project.livekit.cloud`)
   - Optionally `LIVEKIT_AGENT_NAME` – must match your deployed agent (default: `CA_aGnmHJiQijRD`)

3. From the **project root** (`livekit-voice-agent`), go into the UI and install:

   ```bash
   cd ui
   npm install
   npm run dev
   ```

   (If you're already inside `livekit-voice-agent`, use `cd ui` only. Do not use `cd livekit-voice-agent/ui` from inside the project.)

   Open [http://localhost:3000](http://localhost:3000), allow microphone, and talk to the agent.

## Deploy on Vercel

1. Push this repo (or the `ui` folder as the root of a separate repo).
2. In [Vercel](https://vercel.com): **Add New Project** → import the repo, set **Root Directory** to `ui` if the app lives in a subfolder.
3. In **Settings → Environment Variables** add:
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
   - `NEXT_PUBLIC_LIVEKIT_URL`
   - (Optional) `LIVEKIT_AGENT_NAME`
4. Deploy. The API route `/api/token` runs server-side and issues tokens with agent dispatch; the client connects to LiveKit and your agent joins the same room.

## How it works

- **`/api/token`** – Returns a LiveKit JWT with a video grant (room join) and **room config** that dispatches your voice agent to that room when the user joins.
- **Frontend** – Uses `@livekit/components-react` and `livekit-client`: gets a token from the API, connects to the room, and shows the voice agent UI (mic control, agent state, optional bar visualizer). Your agent (hosted on LiveKit Cloud) joins the same room automatically.
