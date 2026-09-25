import sys
import os
from datetime import datetime, date

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
from backend.database import SessionLocal
from backend.models import NoticeBoard

def seed():
    db = SessionLocal()
    try:
        if db.query(NoticeBoard).count() == 0:
            notices = [
                NoticeBoard(
                    notice_title="Sports Day (10th Grade)",
                    notice_text="Annual Sports Meet is scheduled on 25th May 2026.\nStudents must come in proper sports uniform.",
                    notice_date=date(2026, 4, 24),
                    applicable_class="10th Grade A",
                    posted_by=1 # assuming a teacher exists
                ),
                NoticeBoard(
                    notice_title="Annual Day (10th Grade)",
                    notice_text="Annual Day celebrations will take place on 05th June 2026.\nStudents interested in participation should contact their class teachers.",
                    notice_date=date(2026, 3, 31),
                    applicable_class="10th Grade A",
                    posted_by=2
                )
            ]
            db.add_all(notices)
            db.commit()
            print("Seeded database with mock notices.")
        else:
            print("Database already has notices.")
    except Exception as e:
        print(f"Error seeding DB: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
