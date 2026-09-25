import sys
import os
from sqlalchemy import text

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
from backend.database import engine
from backend.models import Base, NoticeBoard

try:
    # Drop table using raw SQL for safety, then create all tables (which will create the new NoticeBoard)
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS notice_board CASCADE"))
        print("Dropped notice_board table.")
    
    # Recreate the table
    Base.metadata.create_all(bind=engine)
    print("Recreated notice_board table with new schema.")
except Exception as e:
    print(f"Error during migration: {e}")
