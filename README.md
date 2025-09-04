# Full-Stack Web Chat with Gemma

This project is a feature-complete, full-stack web application that provides a public chat interface for Google's Gemma LLM, served locally via Ollama. It features persistent, thread-based conversations, real-time message streaming, and a clean, responsive UI.

![Screenshot](placeholder.gif) <!-- TODO: Add a screenshot or gif of the UI -->

## Features

-   **Full-Stack Application:** Python/FastAPI backend and a React/Vite frontend.
-   **No Login Required:** Publicly accessible by default.
-   **Persistent Conversations:** All conversations are stored in a SQLite database.
-   **Thread-Based Interface:** Chats are organized into threads, which can be created, listed, and deleted.
-   **Auto-Title Generation:** New threads are automatically titled by the LLM after the first exchange.
-   **Long-Term Memory:** The system uses LLM-generated summaries to maintain context in long conversations.
-   **Real-Time Streaming:** Assistant responses are streamed in real-time, token by token.
-   **Markdown & Code Support:** Messages are rendered as Markdown, with syntax highlighting and a "copy" button for code blocks.
-   **Search:** Threads can be searched by title.
-   **Containerized:** The entire stack (frontend, backend, Ollama) is managed via Docker and Docker Compose for easy setup and deployment.

## Tech Stack

-   **Backend:** FastAPI, SQLModel, Alembic, Ollama-python
-   **Frontend:** React, TypeScript, Vite, Tailwind CSS, TanStack Query
--   **Database:** SQLite
-   **LLM:** Gemma (served via Ollama)

For more details, see the [Architecture Documentation](./docs/ARCHITECTURE.md).

## Getting Started

### Prerequisites

-   [Docker](https://www.docker.com/get-started) and Docker Compose
-   An Ollama-compatible model. We use `gemma:2b`.

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <repository-name>
```

### 2. Configure Environment Variables

Create a `.env` file in the `backend/` directory by copying the example file.

```bash
cp backend/.env.example backend/.env
```

The default values in `.env` are configured to work with the `docker-compose` setup. You can customize the model name or other parameters if you wish.

### 3. Run the Application

The entire application stack can be started with a single command:

```bash
docker compose up --build
```

This will:
1.  Build the Docker images for the frontend and backend services.
2.  Start the `ollama`, `backend`, and `frontend` containers.
3.  Create the SQLite database and run migrations automatically.

### 4. Pull the LLM Model

The first time you run the application, you need to pull the Ollama model. Open a new terminal and run:

```bash
docker compose exec ollama ollama pull gemma:2b
```

Once the model is downloaded, the application will be fully functional.

### 5. Access the Application

-   **Frontend:** Open your browser to `http://localhost:5173`
-   **Backend API Docs:** `http://localhost:8000/docs`

## Deployment

This application is designed to be easily deployable to platforms that support Docker containers, such as Fly.io or Render.

### Example: Deploying to Fly.io

1.  **Install `flyctl`:** Follow the [official instructions](https://fly.io/docs/hands-on/install-flyctl/).
2.  **Launch the App:** Run `fly launch` in the repository root. It will detect the `docker-compose.yml` and suggest creating multiple applications. It's often easier to deploy the backend and frontend as separate Fly apps.
3.  **Deploy Backend:**
    -   Navigate to the `backend` directory.
    -   Run `fly launch`. Follow the prompts to create a new application.
    -   Ensure you set the `OLLAMA_HOST` secret to point to a running Ollama instance if you are not deploying Ollama on Fly as well.
4.  **Deploy Frontend:**
    -   Navigate to the `frontend` directory.
    -   Run `fly launch`.
    -   Set the `VITE_API_BASE_URL` secret to the URL of your deployed backend application (e.g., `https://my-backend-app.fly.dev`).

## Known Issues

-   **Integration Tests:** The backend integration tests are currently non-functional due to a persistent issue with the test database environment. This is a known gap in test coverage.
-   **Token Counting:** The logic for estimating prompt tokens in `backend/llm.py` is a simple `len(text) // 4` heuristic. For a production environment, this should be replaced with a proper tokenizer library (e.g., `tiktoken`) for more accurate results.
