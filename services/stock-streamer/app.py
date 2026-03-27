import asyncio
import inspect
import math
import os
import re
import time
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, Query
from yfinance import AsyncWebSocket

SYMBOL_PATTERN = re.compile(r"^[A-Z0-9.\-]{1,20}$")
DEFAULT_REQUEST_TTL_SECONDS = 120
DEFAULT_QUOTE_STALE_SECONDS = 30
DEFAULT_IDLE_POLL_SECONDS = 1.0
DEFAULT_BACKOFF_SECONDS = 3.0
MAX_BACKOFF_SECONDS = 30.0


def normalize_symbol(raw: str | None) -> str | None:
  normalized = (raw or "").strip().upper()
  if not normalized or not SYMBOL_PATTERN.fullmatch(normalized):
    return None
  return normalized


def parse_price(value: Any) -> float | None:
  if isinstance(value, (int, float)):
    price = float(value)
    return price if math.isfinite(price) and price > 0 else None

  if isinstance(value, str):
    trimmed = value.strip().replace(",", "")
    if not trimmed:
      return None
    try:
      price = float(trimmed)
    except ValueError:
      return None
    return price if math.isfinite(price) and price > 0 else None

  return None


def format_timestamp(raw_timestamp: Any) -> str:
  if isinstance(raw_timestamp, str):
    trimmed = raw_timestamp.strip()
    if trimmed:
      return trimmed

  if isinstance(raw_timestamp, (int, float)):
    timestamp = float(raw_timestamp)
    if timestamp > 1_000_000_000_000:
      timestamp /= 1_000
    if math.isfinite(timestamp) and timestamp > 0:
      return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()

  return datetime.now(timezone.utc).isoformat()


def extract_quote(payload: Any) -> tuple[str, float, str] | None:
  if isinstance(payload, list):
    for item in payload:
      parsed = extract_quote(item)
      if parsed is not None:
        return parsed
    return None

  if not isinstance(payload, dict):
    return None

  containers = [payload]
  for key in ("data", "quote", "ticker", "payload"):
    value = payload.get(key)
    if isinstance(value, dict):
      containers.append(value)

  for container in containers:
    symbol = normalize_symbol(
      container.get("id")
      or container.get("symbol")
      or container.get("ticker")
      or container.get("code")
    )
    price = parse_price(
      container.get("price")
      or container.get("lastPrice")
      or container.get("regularMarketPrice")
      or container.get("currentPrice")
      or container.get("last")
    )
    if symbol and price is not None:
      return symbol, price, format_timestamp(container.get("timestamp"))

  return None


async def maybe_await(value: Any) -> None:
  if inspect.isawaitable(value):
    await value


class QuoteManager:
  def __init__(self) -> None:
    self.request_ttl_seconds = int(os.getenv("STOCK_REQUEST_TTL_SECONDS", DEFAULT_REQUEST_TTL_SECONDS))
    self.quote_stale_seconds = int(os.getenv("STOCK_QUOTE_STALE_SECONDS", DEFAULT_QUOTE_STALE_SECONDS))
    self._requested_until: dict[str, float] = {}
    self._quotes: dict[str, dict[str, Any]] = {}
    self._state = "idle"
    self._error: str | None = None
    self._lock = asyncio.Lock()
    self._stop_event = asyncio.Event()
    self._resubscribe_event = asyncio.Event()
    self._runner_task: asyncio.Task[None] | None = None
    self._cleanup_task: asyncio.Task[None] | None = None
    self._ws: AsyncWebSocket | None = None

  async def start(self) -> None:
    if self._runner_task is not None:
      return
    self._runner_task = asyncio.create_task(self._run_loop(), name="yahoo-stock-stream-runner")
    self._cleanup_task = asyncio.create_task(self._cleanup_loop(), name="yahoo-stock-stream-cleanup")

  async def stop(self) -> None:
    self._stop_event.set()
    self._resubscribe_event.set()

    websocket = self._ws
    if websocket is not None:
      with suppress(Exception):
        await maybe_await(websocket.close())

    for task in (self._cleanup_task, self._runner_task):
      if task is None:
        continue
      task.cancel()
      with suppress(asyncio.CancelledError):
        await task

  async def touch_symbols(self, symbols: list[str]) -> None:
    normalized = [symbol for symbol in {normalize_symbol(value) for value in symbols} if symbol]
    if not normalized:
      return

    now = time.monotonic()
    async with self._lock:
      previous_symbols = set(self._active_symbols_locked(now))
      for symbol in normalized:
        self._requested_until[symbol] = now + self.request_ttl_seconds
      next_symbols = set(self._active_symbols_locked(now))

    if previous_symbols != next_symbols:
      self._resubscribe_event.set()

  async def snapshot(self, requested_symbols: list[str]) -> dict[str, Any]:
    normalized = [symbol for symbol in {normalize_symbol(value) for value in requested_symbols} if symbol]
    now = time.monotonic()

    async with self._lock:
      quotes: list[dict[str, Any]] = []
      missing_symbols: list[str] = []

      for symbol in normalized:
        cached = self._quotes.get(symbol)
        if cached is None or (now - cached["received_at"]) > self.quote_stale_seconds:
          missing_symbols.append(symbol)
          continue

        quotes.append({
          "symbol": symbol,
          "priceUsd": cached["price_usd"],
          "updatedAt": cached["updated_at"],
        })

      return {
        "quotes": quotes,
        "missingSymbols": missing_symbols,
        "state": self._state,
        "error": self._error,
        "source": "yahoo-finance-websocket",
        "trackedSymbols": self._active_symbols_locked(now),
      }

  async def health(self) -> dict[str, Any]:
    now = time.monotonic()
    async with self._lock:
      return {
        "state": self._state,
        "error": self._error,
        "trackedSymbols": self._active_symbols_locked(now),
        "quoteCount": len(self._quotes),
      }

  async def _run_loop(self) -> None:
    backoff_seconds = DEFAULT_BACKOFF_SECONDS

    while not self._stop_event.is_set():
      self._resubscribe_event.clear()
      active_symbols = await self._active_symbols()
      if not active_symbols:
        await self._set_state("idle", None)
        await self._wait_for_change(DEFAULT_IDLE_POLL_SECONDS)
        backoff_seconds = DEFAULT_BACKOFF_SECONDS
        continue

      websocket = AsyncWebSocket(verbose=False)
      self._ws = websocket

      stop_task: asyncio.Task[bool] | None = None
      resubscribe_task: asyncio.Task[bool] | None = None
      listen_task: asyncio.Task[None] | None = None

      try:
        await self._set_state("connecting", None)
        await websocket.subscribe(active_symbols)
        await self._set_state("connected", None)

        listen_task = asyncio.create_task(websocket.listen(self._handle_message), name="yahoo-stock-listen")
        stop_task = asyncio.create_task(self._stop_event.wait(), name="yahoo-stock-stop-wait")
        resubscribe_task = asyncio.create_task(self._resubscribe_event.wait(), name="yahoo-stock-resubscribe-wait")

        done, pending = await asyncio.wait(
          [listen_task, stop_task, resubscribe_task],
          return_when=asyncio.FIRST_COMPLETED,
        )

        for task in pending:
          task.cancel()
          with suppress(asyncio.CancelledError):
            await task

        if stop_task in done and stop_task.result():
          break

        if resubscribe_task in done and resubscribe_task.result():
          backoff_seconds = DEFAULT_BACKOFF_SECONDS
          continue

        if listen_task in done:
          listen_task.result()
          await self._set_state("connecting", "Yahoo live feed closed, reconnecting")
      except asyncio.CancelledError:
        raise
      except Exception as error:
        await self._set_state("error", f"Yahoo live feed error: {error}")
        await self._wait_for_change(backoff_seconds)
        backoff_seconds = min(backoff_seconds * 2, MAX_BACKOFF_SECONDS)
      finally:
        self._ws = None
        with suppress(Exception):
          await maybe_await(websocket.close())

        for task in (listen_task, stop_task, resubscribe_task):
          if task is None or task.done():
            continue
          task.cancel()
          with suppress(asyncio.CancelledError):
            await task

  async def _cleanup_loop(self) -> None:
    while not self._stop_event.is_set():
      await asyncio.sleep(DEFAULT_IDLE_POLL_SECONDS)
      now = time.monotonic()
      removed_symbols = False

      async with self._lock:
        for symbol, expires_at in list(self._requested_until.items()):
          if expires_at <= now:
            self._requested_until.pop(symbol, None)
            removed_symbols = True

        for symbol, quote in list(self._quotes.items()):
          if (now - quote["received_at"]) > max(self.quote_stale_seconds * 2, self.request_ttl_seconds):
            self._quotes.pop(symbol, None)

      if removed_symbols:
        self._resubscribe_event.set()

  async def _handle_message(self, payload: Any) -> None:
    parsed = extract_quote(payload)
    if parsed is None:
      return

    symbol, price_usd, updated_at = parsed
    async with self._lock:
      self._quotes[symbol] = {
        "price_usd": price_usd,
        "updated_at": updated_at,
        "received_at": time.monotonic(),
      }
      self._error = None
      self._state = "connected"

  async def _active_symbols(self) -> list[str]:
    async with self._lock:
      return self._active_symbols_locked(time.monotonic())

  def _active_symbols_locked(self, now: float) -> list[str]:
    return sorted(
      symbol
      for symbol, expires_at in self._requested_until.items()
      if expires_at > now
    )

  async def _set_state(self, state: str, error: str | None) -> None:
    async with self._lock:
      self._state = state
      self._error = error

  async def _wait_for_change(self, timeout_seconds: float) -> None:
    stop_task = asyncio.create_task(self._stop_event.wait(), name="yahoo-stock-backoff-stop")
    resubscribe_task = asyncio.create_task(self._resubscribe_event.wait(), name="yahoo-stock-backoff-resubscribe")

    try:
      await asyncio.wait(
        [stop_task, resubscribe_task],
        timeout=timeout_seconds,
        return_when=asyncio.FIRST_COMPLETED,
      )
    finally:
      for task in (stop_task, resubscribe_task):
        if task.done():
          continue
        task.cancel()
        with suppress(asyncio.CancelledError):
          await task


quote_manager = QuoteManager()


@asynccontextmanager
async def lifespan(_: FastAPI):
  await quote_manager.start()
  try:
    yield
  finally:
    await quote_manager.stop()


app = FastAPI(title="wallet-stock-streamer", lifespan=lifespan)


@app.get("/healthz")
async def healthz() -> dict[str, Any]:
  return await quote_manager.health()


@app.get("/quotes")
async def get_quotes(
  symbols: str = Query(default=""),
  symbol: list[str] | None = Query(default=None),
) -> dict[str, Any]:
  requested: list[str] = []

  if symbols:
    requested.extend(symbols.split(","))
  if symbol:
    requested.extend(symbol)

  normalized = [value for value in {normalize_symbol(candidate) for candidate in requested} if value]
  if not normalized:
    return {
      "quotes": [],
      "missingSymbols": [],
      "state": "idle",
      "error": None,
      "source": "yahoo-finance-websocket",
      "trackedSymbols": [],
    }

  await quote_manager.touch_symbols(normalized)
  return await quote_manager.snapshot(normalized)
