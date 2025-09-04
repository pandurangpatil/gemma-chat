from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlmodel import create_engine, Session, SQLModel

DATABASE_URL = "sqlite:///chat.db"

# Use event listeners to set PRAGMA for SQLite
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    # echo=True # Uncomment for debugging SQL queries
)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
