from dotenv import load_dotenv
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

load_dotenv()

# Use environment variable for AWS RDS readiness, default to local PostgreSQL
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://swais_app_user:Swaisuser007@swais-db-test-env.cri2kcc26kxg.ap-south-2.rds.amazonaws.com:5432/sss_prod")
print(f"Using database URL: {SQLALCHEMY_DATABASE_URL}")  # Debug log to confirm correct DB URL is loaded                    
# Runtime table-name prefix switch.
# Local dev  : DB_TABLE_PREFIX=""      → plain names  (assignment_master, …)
# RDS / prod : DB_TABLE_PREFIX="sss_"  → sss_ names   (sss_assignment_master, …)
DB_PREFIX = os.getenv("DB_TABLE_PREFIX", "")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,   # test connections before reuse — prevents stale-conn crashes
    pool_recycle=300,     # recycle after 5 min — avoids AWS RDS idle-timeout drops
    pool_size=5,
    max_overflow=10
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency for FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
