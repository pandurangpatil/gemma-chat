import pytest
from fastapi.testclient import TestClient
from sqlmodel import create_engine, Session, SQLModel
from unittest.mock import patch

# Important: app must be imported before models if models are in a separate file
from main import app, get_session
from models import Thread, Message

# Use an in-memory SQLite database for testing
DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# Override the get_session dependency to use the test database
def get_session_override():
    with Session(engine) as session:
        yield session

app.dependency_overrides[get_session] = get_session_override

# This client will be used by all tests
client = TestClient(app)

# Use a pytest fixture to set up and tear down the database for each test
@pytest.fixture(autouse=True)
def setup_and_teardown_database():
    """Fixture to create and drop tables for each test function."""
    SQLModel.metadata.create_all(engine)
    yield
    SQLModel.metadata.drop_all(engine)


# --- Tests ---

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_and_get_thread():
    response_create = client.post("/api/threads", json={"title": "Test Thread"})
    assert response_create.status_code == 201
    data = response_create.json()
    thread_id = data["id"]

    response_get = client.get(f"/api/threads/{thread_id}")
    assert response_get.status_code == 200
    assert response_get.json()["title"] == "Test Thread"


def test_list_and_search_threads():
    # Use the overridden session to set up data directly
    with Session(engine) as session:
        session.add(Thread(title="Apple Banana"))
        session.add(Thread(title="Apple Cherry"))
        session.add(Thread(title="Orange Banana"))
        session.commit()

    response = client.get("/api/threads")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3

    response_search = client.get("/api/threads?q=Apple")
    assert response_search.status_code == 200
    assert len(response_search.json()) == 2


@patch("main.stream_ollama_response")
def test_post_message(mock_stream):
    async def mock_generator():
        yield "Hello there."

    mock_stream.return_value = mock_generator()

    with Session(engine) as session:
        thread = Thread(title="Message Test")
        session.add(thread)
        session.commit()
        thread_id = thread.id

    response = client.post(
        f"/api/threads/{thread_id}/messages",
        json={"content": "User message"}
    )
    assert response.status_code == 200

    with Session(engine) as session:
        db_messages = session.query(Message).where(Message.thread_id == thread_id).all()
        assert len(db_messages) == 2
        assert db_messages[0].content == "User message"
        assert db_messages[1].content == "Hello there."
