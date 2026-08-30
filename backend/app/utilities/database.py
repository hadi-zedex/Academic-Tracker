import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# reads your .env file
load_dotenv() 
DATABASE_URL = os.getenv("DATABASE_URL", "")

# Cloud Postgres URLs (Render/Neon/Supabase) often use postgres:// which SQLAlchemy 1.4+ deprecated
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# the engine manages the actual connection pool to Postgres
engine = create_engine(DATABASE_URL)

# each request gets its own Session — think of it as a "conversation" with the DB
Sessionlocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# every model class (Student, Job, etc.) will inherit from this Base,
# which is how SQLAlchemy knows what tables to create
Base = declarative_base()

def get_db():
    db = Sessionlocal()
    try:
        yield db
    finally:
        db.close()