import asyncio
import db
from uuid import UUID

ANALYSIS_ID = UUID("97911378-0a80-42de-8c5e-a7c54603cd01")


async def main():
    await db.connect_db()

    try:
        async with db.get_pool().acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, status, created_at
                FROM analyses
                WHERE id = $1
                """,
                ANALYSIS_ID,
            )

            if row:
                print("Analysis found:")
                print(dict(row))
            else:
                print("ANALYSIS NOT FOUND IN DATABASE")
    finally:
        await db.close_db()


if __name__ == "__main__":
    asyncio.run(main())
