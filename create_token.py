#!/usr/bin/env python3
"""
Create a LiveKit access token with room agent dispatch.

When a participant joins the room with this token, LiveKit will dispatch your
voice agent to the same room (agent_name must match WorkerOptions.agent_name).

Usage:
  uv run python create_token.py [ROOM_NAME] [PARTICIPANT_IDENTITY]

  Or import and call:
    from create_token import create_token_with_agent_dispatch
    token = create_token_with_agent_dispatch(room_name="my-room", identity="user-123")
"""
from pathlib import Path

from dotenv import dotenv_values

# Load env from .env.local (script dir and cwd)
def _load_env() -> dict[str, str]:
    import os
    out: dict[str, str] = {}
    for d in (Path(__file__).resolve().parent, Path.cwd()):
        for name in (".env.local", ".env"):
            p = d / name
            if p.exists():
                for k, v in (dotenv_values(p) or {}).items():
                    if k and v and k not in out:
                        out[k] = str(v).strip()
    for k, v in os.environ.items():
        if v and k not in out:
            out[k] = v.strip()
    return out


def create_token_with_agent_dispatch(
    *,
    room_name: str = "my-room",
    identity: str = "participant",
    agent_name: str | None = None,
    metadata: str | None = None,
    api_key: str | None = None,
    api_secret: str | None = None,
) -> str:
    """Create a JWT that joins a room and dispatches the agent to that room."""
    from livekit.api import AccessToken, VideoGrants
    from livekit.protocol.room import RoomConfiguration
    from livekit.protocol.agent_dispatch import RoomAgentDispatch
    import json

    env = _load_env()
    api_key = api_key or env.get("LIVEKIT_API_KEY")
    api_secret = api_secret or env.get("LIVEKIT_API_SECRET")
    if not api_key or not api_secret:
        raise ValueError("LIVEKIT_API_KEY and LIVEKIT_API_SECRET required (env or .env.local)")

    agent_name = agent_name or env.get("LIVEKIT_AGENT_NAME", "CA_aGnmHJiQijRD")
    meta = metadata if metadata is not None else json.dumps({})

    token = (
        AccessToken(api_key=api_key, api_secret=api_secret)
        .with_identity(identity)
        .with_grants(VideoGrants(room_join=True, room=room_name))
        .with_room_config(
            RoomConfiguration(
                agents=[
                    RoomAgentDispatch(agent_name=agent_name, metadata=meta),
                ],
            ),
        )
        .to_jwt()
    )
    return token


def main() -> None:
    import sys
    room_name = sys.argv[1] if len(sys.argv) > 1 else "my-room"
    identity = sys.argv[2] if len(sys.argv) > 2 else "participant"
    try:
        token = create_token_with_agent_dispatch(room_name=room_name, identity=identity)
        print(token)
    except ValueError as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
