import logging

from fastapi import FastAPI, HTTPException

from ai_analyzer import analyze_resources


logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Ollama Integration Test",
    description="Temporary API for testing AI analysis with synthetic data.",
)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "message": "Temporary AI test API is running.",
    }


@app.post("/test-ai")
def test_ai():
    """
    Test the existing AI analyzer using synthetic resource data.

    This endpoint does not make AWS API calls or create AWS resources.
    """

    synthetic_resources = [
        {
            "service": "ec2",
            "resource_type": "EC2 Instance",
            "identifier": "SYNTHETIC-TEST-NOT-A-REAL-AWS-RESOURCE",
            "name": "Synthetic test instance",
            "region": "ap-south-1",
            "specifications": {
                "instance_type": "t3.micro",
                "state": "stopped",
            },
            "tags": [],
            "tagged": False,
        }
    ]

    try:
        logger.info(
            "Starting synthetic AI analysis test."
        )

        analysis = analyze_resources(synthetic_resources)

        logger.info(
            "Synthetic AI analysis test completed successfully."
        )

        return {
            "test": "Ollama integration test",
            "status": "success",
            "resource_count": len(synthetic_resources),
            "synthetic_data_only": True,
            "analysis": analysis,
        }

    except Exception as exc:
        logger.exception(
            "Synthetic AI analysis test failed."
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "AI analysis failed. "
                "Check the server terminal for details."
            ),
        ) from exc