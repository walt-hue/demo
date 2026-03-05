import json
import logging
from pathlib import Path

from dotenv import load_dotenv, dotenv_values

from livekit import rtc
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
    inference,
    llm,
    metrics,
    room_io,
    MetricsCollectedEvent,
)
from livekit.plugins import noise_cancellation, rime, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

AVAILABLE_VOICES = {
    "vespera": "Vespera — the default warm female voice",
    "arcade": "Arcade — an energetic, upbeat voice",
    "eliphas": "Eliphas — a calm, steady voice",
}
DEFAULT_VOICE = "vespera"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voice-agent")

load_dotenv()
load_dotenv(".env.local")

# Rime self-hosted endpoint; override with RIME_BASE_URL in .env.local


def _env_get(key: str, default: str = "") -> str:
    """Read from env or .env files. Tries multiple paths so it works in the job process (cwd + __file__ dir)."""
    import os
    val = (os.environ.get(key) or "").strip()
    if val:
        return val
    # Job process may have different cwd; try both script dir and cwd at runtime
    candidates: list[Path] = []
    try:
        candidates.append(Path(__file__).resolve().parent)
    except Exception:
        pass
    try:
        cwd = Path.cwd()
        if cwd not in candidates:
            candidates.append(cwd)
    except Exception:
        pass
    for d in candidates:
        for name in (".env.local", ".env"):
            p = d / name
            if p.exists():
                val = (dotenv_values(p).get(key) or "").strip()
                if val:
                    return val
    return default


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""\
You are an Uber rider-support agent on a live phone call. Riders call when they can't find their driver or need help with pickup. You sound like a real person on a support line, not a robot reading a script.

PERSONALITY AND TONE:
You carry a steady, chill confidence. Your default gear is relaxed and reassuring. You're patient even when the caller is stressed. You talk the way a helpful coworker would, not the way a corporate FAQ reads. Break grammar rules. Start sentences with "And," "But," or "So." Use "like" and "okay" naturally.

SPEECH STYLE:
Keep responses short. One to two sentences max. This is a phone call, not an email. Never use bullet points, numbered lists, asterisks, emojis, or any special formatting. Just talk.

FILLER WORDS AND PAUSES:
Use filler words naturally: "um," "so," "okay," "ya," "like," "alright." When you say "um," always follow it with a brief pause, then pick back up with "so" or another connector. Pauses are fine and make you sound human.

WHAT GOOD OUTPUT SOUNDS LIKE:
Bad: "I'd be happy to assist you with locating your driver."
Good: "Ya, okay so, let me help you find your driver, no problem."
Bad: "Could you please provide me with your current address?"
Good: "So um, where are you right now? Like, a street name or a building nearby?"
Bad: "I understand that can be frustrating. Let me look into that for you."
Good: "Yeah, I totally get that. So um, let me just take a look here for you."
Bad: "Unfortunately, it appears your driver may have gone to the wrong location."
Good: "So... it looks like your driver might've gone to the wrong spot, which, ya, that's annoying."

LEAN INTO THIS HARD:
Everything below is essential. You are mid-conversation on a phone call, not presenting a keynote:
- Filler words are good: "um," "so," "okay," "ya so," "like," "alright"
- After every standalone "um," pause briefly, then pick up again with "so" or "ya"
- Loop back casually when returning to a topic: "Oh and about that other thing" or "So going back to what you said"
- If you think you misheard: "Sorry, I think I missed that, what did you say?"
- When the caller says goodbye, wish them a good rest of their day

YOUR JOB:
Help the rider connect with their driver. To do that you may need:
- Where they are right now (address, intersection, landmark, what they see around them)
- Where the pickup was supposed to be, if it's different
- Their destination if that helps narrow things down
- Any other detail that helps

Confirm details back casually: "Okay so you're at the corner of 5th and Main, got it." Then let them know what happens next, like "Alright, so I'm gonna get this over to your driver right now."

VOICE SWITCHING:
You can switch your voice if the caller asks. The available voices are: vespera (the default, warm female), arcade (energetic, upbeat), and eliphas (calm, steady). If the caller asks you to change your voice or sound different, use the switch_voice tool with the matching voice name. After switching, casually confirm the change like "Alright, how's this sound?" Keep it natural.

MAP AND RIDE TOOLS:
You have tools that control a live map the rider can see on their screen. Use them naturally during the conversation:
- When the rider tells you where they are, call set_pickup_location with their address and approximate San Francisco coordinates.
- When the rider mentions their destination, call set_dropoff_location with the address and coordinates.
- After confirming both locations, simulate finding a driver. Call update_driver_status with status "en_route", a position a few blocks from pickup, and an ETA of 3-5 minutes.
- After a brief pause, call update_driver_status again with status "arriving" and coordinates near the pickup.
- When the rider confirms they see the driver or are getting in, call start_ride.
- When the conversation wraps up or rider says they arrived, call complete_ride.

Use realistic San Francisco coordinates. Examples: Ferry Building (37.7955, -122.3937), Union Square (37.7879, -122.4074), Fishermans Wharf (37.8080, -122.4177), Mission District (37.7599, -122.4148), SOMA (37.7785, -122.3950). Estimate reasonable coordinates for other locations.

WHAT TO AVOID:
- Never sound scripted or corporate
- Never use long sentences or paragraph-length responses
- Never say "I'd be happy to assist" or "Thank you for your patience" or any generic support phrases
- Never use markdown, bullet points, or any text formatting""",
        )

    @llm.function_tool()
    async def switch_voice(self, voice_name: str) -> str:
        """Switch the speaking voice. Available voices: vespera (warm female, default), arcade (energetic, upbeat), eliphas (calm, steady).

        Args:
            voice_name: The voice to switch to. Must be one of: vespera, arcade, eliphas.
        """
        voice_name = voice_name.strip().lower()
        if voice_name not in AVAILABLE_VOICES:
            return f"Unknown voice '{voice_name}'. Available voices: {', '.join(AVAILABLE_VOICES.keys())}"

        tts_instance = self.session.tts
        if tts_instance and isinstance(tts_instance, rime.TTS):
            tts_instance.update_options(speaker=voice_name)
            logger.info("Voice switched to: %s", voice_name)
            return f"Voice switched to {voice_name}."

        return "Could not switch voice — TTS not available."

    async def _publish_map_update(self, action: str, data: dict | None = None) -> None:
        """Publish a map update message to the room."""
        payload = json.dumps({"action": action, "data": data or {}}).encode()
        await self.session.room_io.room.local_participant.publish_data(
            payload, reliable=True, topic="map_update"
        )

    @llm.function_tool()
    async def set_pickup_location(self, address: str, latitude: float, longitude: float) -> str:
        """Set the rider's pickup location on the map.

        Args:
            address: Street address or description of the pickup location.
            latitude: Latitude coordinate (e.g. 37.7879 for Union Square).
            longitude: Longitude coordinate (e.g. -122.4074 for Union Square).
        """
        await self._publish_map_update("set_pickup", {
            "address": address, "lat": latitude, "lng": longitude,
        })
        logger.info("Pickup set: %s (%.4f, %.4f)", address, latitude, longitude)
        return f"Pickup location set to {address}."

    @llm.function_tool()
    async def set_dropoff_location(self, address: str, latitude: float, longitude: float) -> str:
        """Set the rider's dropoff/destination location on the map.

        Args:
            address: Street address or description of the destination.
            latitude: Latitude coordinate.
            longitude: Longitude coordinate.
        """
        await self._publish_map_update("set_dropoff", {
            "address": address, "lat": latitude, "lng": longitude,
        })
        logger.info("Dropoff set: %s (%.4f, %.4f)", address, latitude, longitude)
        return f"Dropoff location set to {address}."

    @llm.function_tool()
    async def update_driver_status(self, status: str, latitude: float, longitude: float, eta_minutes: int) -> str:
        """Update the driver's status and position on the map.

        Args:
            status: Driver status — either "en_route" or "arriving".
            latitude: Driver's current latitude.
            longitude: Driver's current longitude.
            eta_minutes: Estimated minutes until arrival at pickup.
        """
        await self._publish_map_update("update_driver", {
            "status": status, "lat": latitude, "lng": longitude, "eta_minutes": eta_minutes,
        })
        logger.info("Driver update: status=%s pos=(%.4f, %.4f) eta=%dm", status, latitude, longitude, eta_minutes)
        return f"Driver status updated to {status}, ETA {eta_minutes} minutes."

    @llm.function_tool()
    async def start_ride(self) -> str:
        """Start the ride after the rider has been picked up."""
        await self._publish_map_update("start_ride")
        logger.info("Ride started")
        return "Ride started."

    @llm.function_tool()
    async def complete_ride(self) -> str:
        """Complete the ride when the rider has arrived at their destination."""
        await self._publish_map_update("complete_ride")
        logger.info("Ride completed")
        return "Ride completed."


def prewarm(proc: JobProcess) -> None:
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext) -> None:
    ctx.log_context_fields = {"room": ctx.room.name}

    base_url = _env_get("RIME_BASE_URL", "https://users-east.rime.ai/v1/rime-tts")
    api_key = _env_get("RIME_API_KEY")
    if not api_key:
        raise ValueError("RIME_API_KEY is required. Add it to .env.local next to agent.py.")

    rime_model = "arcanav2"
    rime_speaker = "vespera"
    logger.info("Rime TTS: model=%s speaker=%s base_url=%s", rime_model, rime_speaker, base_url)

    session = AgentSession(
        vad=ctx.proc.userdata["vad"],
        stt=inference.STT(model="deepgram/nova-3-general", language="multi"),
        llm=inference.LLM(model="openai/gpt-4.1-mini"),
        tts=rime.TTS(
            model=rime_model,
            speaker=rime_speaker,
            speed_alpha=0.9,
            base_url=base_url,
            api_key=api_key,
        ),
        turn_detection=MultilingualModel(),
    )

    usage_collector = metrics.UsageCollector()

    @session.on("metrics_collected")
    def _on_metrics_collected(ev: MetricsCollectedEvent) -> None:
        metrics.log_metrics(ev.metrics, logger=logger)
        usage_collector.collect(ev.metrics)

    async def log_usage_summary() -> None:
        summary = usage_collector.get_summary()
        logger.info(
            "Session usage summary: llm_prompt_tokens=%s llm_completion_tokens=%s "
            "tts_characters=%s tts_audio_duration_s=%.2f stt_audio_duration_s=%.2f",
            summary.llm_prompt_tokens,
            summary.llm_completion_tokens,
            summary.tts_characters_count,
            summary.tts_audio_duration,
            summary.stt_audio_duration,
        )

    ctx.add_shutdown_callback(log_usage_summary)

    await session.start(
        agent=Assistant(),
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: (
                    noise_cancellation.BVCTelephony()
                    if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                    else noise_cancellation.BVC()
                ),
            ),
        ),
    )

    await session.generate_reply(
        instructions="Greet the caller casually as Uber support. Say something like 'Hey, this is Uber support, what's going on?' Keep it short and natural."
    )


if __name__ == "__main__":
    # Explicit agent_name for telephony dispatch; must match dispatch rule's agentName.
    # Set LIVEKIT_AGENT_NAME in env (e.g. CA_aGnmHJiQijRD) or we use a default for local dev.
    import os
    agent_name = os.environ.get("LIVEKIT_AGENT_NAME", "CA_aGnmHJiQijRD")
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            agent_name=agent_name,
        )
    )
