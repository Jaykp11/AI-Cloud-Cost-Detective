import asyncio
import json
from uuid import uuid4

import db


async def main():
    # Generate unique IDs for temporary test records.
    user_id = uuid4()
    analysis_id = uuid4()
    test_email = f"db-test-{user_id}@example.com"

    try:
        # 1. Connect to PostgreSQL and initialize the schema.
        await db.connect_db()
        print("PASS: Database connection established.")

        # 2. Create a temporary test user.
        user = await db.create_user(
            user_id=user_id,
            email=test_email,
            password_hash="TEST_HASH_NOT_FOR_AUTHENTICATION",
        )

        assert str(user["id"]) == str(user_id)
        assert user["email"] == test_email

        print("PASS: Temporary user created.")

        # 3. Create a synthetic analysis record.
        await db.create_analysis(
            analysis_id=analysis_id,
            user_id=user_id,
            region="ap-south-1",
        )

        print("PASS: Analysis record created.")

        # 4. Update the record with synthetic results.
        synthetic_result = {
            "resources": [],
            "resource_count": 0,
            "synthetic_test": True,
            "analysis": {
                "summary": "Database persistence test.",
                "estimated_monthly_savings": {
                    "amount": None,
                    "currency": "USD",
                    "confidence": "low",
                    "assumptions": [],
                },
                "issues": [],
                "additional_data_required": [],
                "limitations": [
                    "Synthetic test data; not an actual AWS assessment."
                ],
            },
        }

        await db.update_analysis(
            analysis_id=analysis_id,
            user_id=user_id,
            status="completed",
            resources_scanned=0,
            issues_found=0,
            estimated_savings="Not estimated",
            analysis_result=synthetic_result,
        )

        print("PASS: Analysis record updated.")

        # 5. Retrieve the record through the application's DB function.
        records = await db.get_user_analyses(
            user_id=user_id,
            limit=10,
            offset=0,
        )

        saved_record = next(
            (
                record
                for record in records
                if str(record["id"]) == str(analysis_id)
            ),
            None,
        )

        assert saved_record is not None, "Analysis was not retrieved."
        assert saved_record["status"] == "completed"
        assert saved_record["region"] == "ap-south-1"
        assert saved_record["resources_scanned"] == 0

        result = saved_record["analysis_result"]

        # asyncpg may return JSONB as a dict or as a JSON string,
        # depending on its configuration.
        if isinstance(result, str):
            result = json.loads(result)

        assert result["synthetic_test"] is True
        assert (
            result["analysis"]["summary"]
            == "Database persistence test."
        )

        print("PASS: Saved analysis retrieved successfully.")
        print("PASS: Stored JSONB result verified.")
        print("PASS: Analysis status and metadata verified.")

    finally:
        # Delete only the temporary user created by this test.
        # The foreign key cascades deletion to its test analyses.
        try:
            pool = db.get_pool()
            async with pool.acquire() as connection:
                await connection.execute(
                    "DELETE FROM users WHERE id = $1",
                    user_id,
                )
            print("CLEANUP: Temporary test records removed.")

        finally:
            await db.close_db()


if __name__ == "__main__":
    asyncio.run(main())