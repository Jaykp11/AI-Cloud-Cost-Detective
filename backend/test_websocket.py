import asyncio
import json
import os
import sys
from uuid import uuid4

from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed


BASE_URL = "ws://127.0.0.1:8000/ws/progress"
TOKEN = os.getenv("ACCESS_TOKEN")


async def main():
    if not TOKEN:
        print("FAIL: ACCESS_TOKEN is missing.")
        sys.exit(1)

    analysis_id = str(uuid4())
    url = f"{BASE_URL}/{analysis_id}?token={TOKEN}"

    print("Analysis ID:", analysis_id)
    print("Connecting to WebSocket...")

    try:
        async with connect(url, open_timeout=10) as websocket:
            print("PASS: WebSocket connection established.")

            # The handler sends a connection confirmation immediately.
            raw = await asyncio.wait_for(
                websocket.recv(),
                timeout=5,
            )
            message = json.loads(raw)

            print("Initial message:", json.dumps(message, indent=2))

            assert message.get("status") == "connected", (
                "Expected connection confirmation."
            )
            assert message.get("analysis_id") == analysis_id

            print("PASS: Initial connection confirmation received.")

            # Verify the handler's ping/pong behavior.
            await websocket.send("ping")

            raw = await asyncio.wait_for(
                websocket.recv(),
                timeout=5,
            )
            message = json.loads(raw)

            print("Ping response:", json.dumps(message, indent=2))

            assert message.get("message") == "pong"
            assert message.get("status") == "connected"

            print("PASS: Ping/pong verified.")
            print("PASS: Basic WebSocket authentication and messaging work.")

            print(
                "\nNote: This test verifies the connection and ping/pong. "
                "It does not yet verify progress updates during a real analysis."
            )

    except Exception as exc:
        print(f"FAIL: {type(exc).__name__}: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
