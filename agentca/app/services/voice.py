"""Voice transcription — Groq Whisper (FREE)."""

from __future__ import annotations
import logging
from groq import AsyncGroq
from app.config import get_settings

logger = logging.getLogger(__name__)


async def transcribe(audio_bytes: bytes, language: str = "hi") -> str:
    """Transcribe voice note using Groq Whisper (FREE)."""
    try:
        client = AsyncGroq(api_key=get_settings().groq_api_key)

        transcription = await client.audio.transcriptions.create(
            file=("voice.ogg", audio_bytes),
            model="whisper-large-v3-turbo",
            language=language[:2],  # hi, en, gu, ta, te, mr
            response_format="text",
        )
        logger.info(f"voice_transcribed: {len(audio_bytes)} bytes → {len(transcription)} chars")
        return transcription.strip()

    except Exception as e:
        logger.error(f"voice_error: {e}")
        return ""
