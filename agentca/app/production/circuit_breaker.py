"""Circuit breaker for external API calls (Groq, Gemini, WhatsApp)."""

from __future__ import annotations
import time
import logging
from enum import Enum
from functools import wraps

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    CLOSED = "closed"      # Normal — requests pass through
    OPEN = "open"          # Tripped — requests fail immediately
    HALF_OPEN = "half_open"  # Testing — allow one request through


class CircuitBreakerError(Exception):
    """Raised when circuit is open."""
    pass


class CircuitBreaker:
    """
    Circuit breaker pattern.
    After `failure_threshold` failures in `window` seconds, circuit opens.
    After `recovery_timeout` seconds, circuit moves to half-open.
    One success in half-open → close. One failure in half-open → re-open.
    """

    def __init__(
        self,
        name: str = "default",
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        window: float = 60.0,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.window = window
        self.state = CircuitState.CLOSED
        self.failures: list[float] = []
        self.opened_at: float = 0

    def _clean_old_failures(self):
        now = time.monotonic()
        self.failures = [t for t in self.failures if now - t < self.window]

    def record_failure(self):
        self.failures.append(time.monotonic())
        self._clean_old_failures()
        if len(self.failures) >= self.failure_threshold:
            self.state = CircuitState.OPEN
            self.opened_at = time.monotonic()
            logger.warning(f"circuit_breaker: {self.name} OPENED after {len(self.failures)} failures")

    def record_success(self):
        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.CLOSED
            self.failures.clear()
            logger.info(f"circuit_breaker: {self.name} CLOSED (recovered)")

    def can_execute(self) -> bool:
        if self.state == CircuitState.CLOSED:
            return True
        if self.state == CircuitState.OPEN:
            if time.monotonic() - self.opened_at >= self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
                logger.info(f"circuit_breaker: {self.name} HALF-OPEN (testing)")
                return True
            return False
        # HALF_OPEN: allow one request
        return True

    def __call__(self, func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if not self.can_execute():
                raise CircuitBreakerError(f"Circuit {self.name} is OPEN")
            try:
                result = await func(*args, **kwargs)
                self.record_success()
                return result
            except Exception as e:
                self.record_failure()
                raise
        return wrapper


# Pre-configured breakers for each external service
groq_breaker = CircuitBreaker(name="groq", failure_threshold=5, recovery_timeout=30)
gemini_breaker = CircuitBreaker(name="gemini", failure_threshold=5, recovery_timeout=30)
whatsapp_breaker = CircuitBreaker(name="whatsapp", failure_threshold=10, recovery_timeout=15)
