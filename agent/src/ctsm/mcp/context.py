from datetime import datetime


async def get_context():
    return {"date": datetime.now().strftime("%Y-%m-%d")}
