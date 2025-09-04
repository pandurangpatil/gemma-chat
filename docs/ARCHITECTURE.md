# Architecture Decisions

This document outlines the architectural choices made for the "Chat-with-Gemma" web application.

## Tech Stack

The application is built using the **Python/FastAPI + React/Vite** stack (Option B from the project brief).

-   **Backend:** **FastAPI** was chosen for its high performance, asynchronous support (critical for handling streaming LLM responses), and automatic documentation generation. Its dependency injection system simplifies database connections and other dependencies.

-   **Frontend:** **React** (with **Vite**) provides a modern, fast, and scalable foundation for the user interface. Vite offers an extremely fast development server with Hot Module Replacement (HMR). **TypeScript** is used for type safety and improved developer experience.

-   **Database:** **SQLModel** serves as the ORM, combining the power of SQLAlchemy with the validation of Pydantic. This makes database models and API schemas easy to define and keep in sync. **SQLite** is used for local development for its simplicity, with **Alembic** managing database migrations. The setup is designed to be easily swappable to a more robust database like PostgreSQL for production.

-   **Styling:** **Tailwind CSS** is used for utility-first styling, allowing for rapid UI development and easy customization.

## Data Flow

A typical user interaction (sending a message) follows this flow:

1.  **User Input:** The user types a message in the React frontend and submits it.
2.  **API Request:** The frontend client (`ChatView.tsx`) sends a `POST` request to the `/api/threads/{thread_id}/messages` endpoint on the FastAPI backend.
3.  **Backend Processing:**
    a. The backend receives the request and saves the user's message to the SQLite database.
    b. It constructs a prompt for the LLM by pulling the thread's summary and the most recent messages from the database, ensuring the total context fits within a predefined token budget.
    c. It sends this prompt to the Ollama-hosted Gemma model via an HTTP request, with `stream: true`.
4.  **Streaming Response:**
    a. Ollama begins sending back the response as a stream of Server-Sent Events (SSE).
    b. The FastAPI backend receives these chunks and immediately forwards them to the frontend client through an open SSE connection.
5.  **Frontend Rendering:**
    a. The React frontend (`ChatView.tsx`) listens for these events. As each chunk of text arrives, it appends it to the assistant's message in the UI, creating a real-time "typing" effect.
    b. The content is rendered as Markdown.
6.  **Post-Response Tasks:**
    a. Once the stream is complete, the backend saves the full assistant response to the database.
    b. If it's the first exchange in a thread, a separate LLM call is made to generate a concise title for the conversation.
    c. Periodically, another LLM call is made to update the thread's summary, which will be used to provide context for future conversations in that thread.

## Prompt Composition

To maintain context while managing token limits, prompts sent to the LLM are composed as follows:

1.  **System Prompt:** A configurable, high-level instruction that sets the assistant's persona and behavior.
2.  **Conversation Summary:** A concise, LLM-generated summary of the conversation so far. This is included to provide long-term context for threads with many messages.
3.  **Recent Messages:** The most recent messages from the thread history are appended until the `CONTEXT_TOKEN_BUDGET` is nearly reached. This provides the immediate, turn-by-turn context for the conversation.
4.  **New User Message:** The user's latest message is the final part of the prompt.

This layered approach ensures the LLM has both long-term and short-term context to generate relevant and accurate responses.

---
### A Note on Database Migrations in Docker

The current `backend/Dockerfile` runs `alembic upgrade head` during the image build process. For the local SQLite setup, this works fine as it simply creates the database file within the image.

For a production environment using a persistent database like PostgreSQL, a better practice would be to decouple the migration step from the application build. This can be achieved by:
1.  Creating a separate `migrate` command in the `Dockerfile` or a separate script.
2.  Running this command as part of the deployment process before starting the main application server (e.g., using a release command on a platform like Fly.io or Render, or as a separate `command` in a `docker-compose` setup for production).
