"""
Run once after first launch to create base users + portfolios.
Usage: python seed.py
"""

import asyncio
from app.database import AsyncSessionLocal, init_db
from app.models.models import Portfolio, User


async def seed():
    await init_db()

    async with AsyncSessionLocal() as db:
        # Users
        agathe = User(
            name="Agathe",
            color="#a855f7",
            # Fill your actual PEA data below
            pea_opening_date=None,
            pea_deposits_total=0.0,
            pea_withdrawals_total=0.0,
        )
        victor = User(
            name="Victor",
            color="#eab308",
        )
        db.add_all([agathe, victor])
        await db.flush()

        # Portfolios — Agathe
        db.add_all([
            Portfolio(user_id=agathe.id, name="PEA Agathe", envelope_type="PEA", broker="Fortuneo"),
            Portfolio(user_id=agathe.id, name="CTO Agathe", envelope_type="CTO", broker="Fortuneo"),
            Portfolio(user_id=agathe.id, name="PEE Corporate", envelope_type="PEE", broker="Amundi"),
        ])

        # Portfolios — Victor (stratégie dividendes Euronext)
        db.add_all([
            Portfolio(user_id=victor.id, name="PEA Victor", envelope_type="PEA", broker="Fortuneo"),
            Portfolio(user_id=victor.id, name="CTO Victor", envelope_type="CTO", broker="Fortuneo"),
        ])

        await db.commit()
        print("✓ Seed terminé — utilisateurs et portefeuilles créés.")


if __name__ == "__main__":
    asyncio.run(seed())
