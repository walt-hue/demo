"""Custom TTS adapter for the Etna endpoint (returns audio/wav instead of audio/pcm)."""

from __future__ import annotations

import asyncio
import io
import struct
import wave

import aiohttp

from livekit.agents import tts, utils
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS, APIConnectOptions

import logging

logger = logging.getLogger("etna-tts")

DEFAULT_SAMPLE_RATE = 22050
NUM_CHANNELS = 1


class EtnaTTS(tts.TTS):
    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str = "etna",
        speaker: str = "hardy-vo_jade",
        sample_rate: int = DEFAULT_SAMPLE_RATE,
    ) -> None:
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=sample_rate,
            num_channels=NUM_CHANNELS,
        )
        self._base_url = base_url
        self._api_key = api_key
        self._model = model
        self._speaker = speaker
        self._session: aiohttp.ClientSession | None = None

    def _ensure_session(self) -> aiohttp.ClientSession:
        if not self._session:
            self._session = utils.http_context.http_session()
        return self._session

    def synthesize(
        self, text: str, *, conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS
    ) -> "EtnaChunkedStream":
        return EtnaChunkedStream(tts=self, input_text=text, conn_options=conn_options)


class EtnaChunkedStream(tts.ChunkedStream):
    def __init__(self, tts: EtnaTTS, input_text: str, conn_options: APIConnectOptions) -> None:
        super().__init__(tts=tts, input_text=input_text, conn_options=conn_options)
        self._etna: EtnaTTS = tts

    async def _run(self, output_emitter: tts.AudioEmitter) -> None:
        payload = {
            "text": self._input_text,
            "speaker": self._etna._speaker,
            "modelId": self._etna._model,
        }

        logger.info(
            "Etna TTS _run: url=%s speaker=%s model=%s text_len=%d",
            self._etna._base_url, self._etna._speaker, self._etna._model, len(self._input_text),
        )

        try:
            async with self._etna._ensure_session().post(
                self._etna._base_url,
                headers={
                    "Content-Type": "application/json",
                    "accept": "audio/wav",
                    "Authorization": f"Bearer {self._etna._api_key}",
                },
                json=payload,
                timeout=aiohttp.ClientTimeout(total=60, sock_connect=self._conn_options.timeout),
            ) as resp:
                logger.info("Etna TTS response: status=%d content_type=%s", resp.status, resp.content_type)
                resp.raise_for_status()
                wav_bytes = await resp.read()
                logger.info("Etna TTS: received %d bytes", len(wav_bytes))

                with io.BytesIO(wav_bytes) as buf:
                    with wave.open(buf, "rb") as wf:
                        actual_sr = wf.getframerate()
                        n_channels = wf.getnchannels()
                        sample_width = wf.getsampwidth()
                        pcm_data = wf.readframes(wf.getnframes())

                logger.info(
                    "Etna WAV parsed: sr=%d ch=%d sw=%d pcm_bytes=%d",
                    actual_sr, n_channels, sample_width, len(pcm_data),
                )

                output_emitter.initialize(
                    request_id=utils.shortuuid(),
                    sample_rate=actual_sr,
                    num_channels=n_channels,
                    mime_type="audio/pcm",
                )
                output_emitter.push(pcm_data)
                logger.info("Etna TTS: audio pushed to emitter")

        except asyncio.TimeoutError:
            logger.error("Etna TTS: TIMEOUT connecting to %s", self._etna._base_url)
            raise tts.APITimeoutError() from None
        except aiohttp.ClientResponseError as e:
            logger.error("Etna TTS: HTTP %d — %s", e.status, e.message)
            raise tts.APIStatusError(
                message=e.message, status_code=e.status, request_id=None, body=None
            ) from None
        except Exception as e:
            logger.error("Etna TTS: unexpected error — %s: %s", type(e).__name__, e)
            raise tts.APIConnectionError() from e
