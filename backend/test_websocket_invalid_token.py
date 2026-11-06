import asyncio
from uuid import uuid4

from websockets.asyncio.client import connect
from websockets.exceptions import InvalidStatus, ConnectionClosed


async def main():
    url = (
        "ws://127.0.0.1:8000/ws/progress/"
        f"{uuid4()}?token=invalid-test-token"
    )

    try:
        async with connect(url, open_timeout=5) as websocket:
            try:
                message = await asyncio.wait_for(
                    websocket.recv(),
                    timeout=3,
                )
                print("FAIL: Unexpected message:", message)

            except ConnectionClosed as exc:
                if exc.code == 1008:
                    print("PASS: Invalid token rejected with close code 1008.")
                else:
                    print(f"FAIL: Unexpected close code {exc.code}.")

    except InvalidStatus as exc:
        status = exc.response.status_code
        if status == 403:
            print("PASS: Invalid token rejected during handshake with HTTP 403.")
        else:
            print(f"FAIL: Unexpected HTTP status {status}.")

    except Exception as exc:
        print(f"FAIL: {type(exc).__name__}: {exc}")


if __name__ == "__main__":
    asyncio.run(main())
