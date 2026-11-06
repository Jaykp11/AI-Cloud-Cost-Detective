import asyncio
import json
import os
import sys
from uuid import uuid4

import httpx
from websockets.asyncio.client import connect


API_URL = "http://127.0.0.1:8000"
WS_URL = "ws://127.0.0.1:8000/ws/progress"
TOKEN = os.getenv("ACCESS_TOKEN")

# Maximum time allowed for the complete test.
TEST_TIMEOUT = 180


async def main():
    if not TOKEN:
        print("FAIL: ACCESS_TOKEN is missing.")
        print("Obtain a fresh token using your existing login procedure.")
        sys.exit(1)

    analysis_id = str(uuid4())
    ws_url = f"{WS_URL}/{analysis_id}?token={TOKEN}"
    headers = {"Authorization": f"Bearer {TOKEN}"}

    messages = []
    analysis_task = None

    print("Analysis ID:", analysis_id)
    print("Connecting to WebSocket...")

    try:
        async with connect(ws_url, open_timeout=10) as websocket:
            first_message = json.loads(
                await asyncio.wait_for(websocket.recv(), timeout=5)
            )

            print("WebSocket connected:", first_message)

            if first_message.get("status") != "connected":
                raise AssertionError(
                    "Missing WebSocket connection confirmation."
                )

            print("PASS: WebSocket connected before analysis.")

            async with httpx.AsyncClient(
                timeout=httpx.Timeout(150, connect=5)
            ) as client:

                # Start the HTTP analysis request in the background.
                analysis_task = asyncio.create_task(
                    client.post(
                        f"{API_URL}/api/analyze",
                        headers=headers,
                        json={
                            "region": "ap-south-1",
                            "analysis_id": analysis_id,
                        },
                    )
                )

                print("Analysis request submitted.")
                print("Waiting for live progress messages...")

                deadline = asyncio.get_running_loop().time() + TEST_TIMEOUT
                completion_received = False

                while asyncio.get_running_loop().time() < deadline:
                    # Stop only when both the HTTP request has finished
                    # and the terminal WebSocket event has been received.
                    if analysis_task.done() and completion_received:
                        break

                    try:
                        raw = await asyncio.wait_for(
                            websocket.recv(),
                            timeout=2,
                        )
                    except asyncio.TimeoutError:
                        if analysis_task.done():
                            # The HTTP request may have finished before
                            # the final WebSocket event was delivered.
                            continue

                        print("Still waiting for analysis/progress...")
                        continue

                    message = json.loads(raw)
                    messages.append(message)

                    status = message.get("status")
                    text = message.get("message", "")

                    print(f"Progress: {status} - {text}")

                    if status == "completed":
                        completion_received = True
                    elif status == "failed":
                        completion_received = True
                        print("The backend reported an analysis failure.")

                if not analysis_task.done():
                    analysis_task.cancel()
                    await asyncio.gather(
                        analysis_task,
                        return_exceptions=True,
                    )
                    raise TimeoutError(
                        "Analysis HTTP request did not finish in time."
                    )

                response = await analysis_task

                print("Analysis HTTP status:", response.status_code)

                if response.status_code != 200:
                    print("Analysis response:", response.text)
                    raise AssertionError(
                        "Analysis endpoint did not return HTTP 200."
                    )

                result = response.json()

                if result.get("analysis_id") != analysis_id:
                    print("Analysis response:", result)
                    raise AssertionError("Analysis ID mismatch.")

                print("PASS: Analysis endpoint returned HTTP 200.")

                progress_messages = [
                    message
                    for message in messages
                    if message.get("status") == "in_progress"
                ]

                completed_messages = [
                    message
                    for message in messages
                    if message.get("status") == "completed"
                ]

                failed_messages = [
                    message
                    for message in messages
                    if message.get("status") == "failed"
                ]

                print("Progress messages received:", len(progress_messages))
                print("Completion messages received:", len(completed_messages))
                print("Failure messages received:", len(failed_messages))

                if failed_messages:
                    raise AssertionError(
                        "The backend reported a failed analysis."
                    )

                if not progress_messages:
                    raise AssertionError("No progress messages received.")

                if not completed_messages:
                    raise AssertionError("No completion event received.")

                print("PASS: Live progress updates received.")
                print("PASS: Completion event received.")

    except Exception as exc:
        print(f"FAIL: {type(exc).__name__}: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nTest interrupted.")
        sys.exit(1)
