# Full-Stack Web Chat with Gemma

This project is a feature-complete, full-stack web application that provides a public chat interface for Google's Gemma LLM, served locally via Ollama. It features persistent, thread-based conversations, real-time message streaming, and a clean, responsive UI.

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
-   **Database:** SQLite
-   **LLM:** Gemma (served via Ollama)

For more details, see the [Architecture Documentation](./docs/ARCHITECTURE.md).

## Getting Started

### Prerequisites

-   [Docker](https://www.docker.com/get-started) and Docker Compose
-   An Ollama-compatible model. We recommend `gemma:2b`.

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <repository-name>
```

### 2. Configure Environment Variables

Create a `.env` file in the `backend/` directory by copying the example file. This step is optional, as the default values are configured to work with the Docker Compose setup.

```bash
cp backend/.env.example backend/.env
```

### 3. Build and Run the Application

The entire application stack can be started with a single command. This will build the Docker images, start the containers, and run the database migrations automatically.

```bash
docker compose up --build
```

### 4. Pull the LLM Model

The first time you run the application, you need to pull the LLM model. Open a **new terminal** and run the following command:

```bash
docker compose exec ollama ollama pull gemma:2b
```

Once the model is downloaded, the application will be fully functional.

### 5. Access the Application

-   **Frontend:** Open your browser to `http://localhost:5173`
-   **Backend API Docs:** `http://localhost:8000/docs`

After running the application, you can take a screenshot of the UI and add it to the `README.md` to replace the placeholder.

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

## Ubuntu Server Setup (Without Docker)

While Docker is the recommended way to run this application, you can also run it directly on an Ubuntu server. Here are the steps to set up the environment from scratch.

### Prerequisites

First, install the necessary system packages.

```bash
sudo apt update
sudo apt install -y git python3-pip nodejs npm nginx
```

It is also recommended to use a Python virtual environment to manage backend dependencies.

```bash
sudo apt install -y python3-venv
```

This guide assumes you are using `python3` and `pip3`.

### 1. Install Ollama

Install Ollama on your server by running the official installation script:

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

After installation, pull the `gemma:2b` model:

```bash
ollama pull gemma:2b
```

By default, Ollama runs as a systemd service. You can check its status with `systemctl status ollama`.

### 2. Clone the Repository

```bash
git clone <repository-url>
cd <repository-name>
```

### 3. Backend Setup

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

2.  **Create and activate a virtual environment:**
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure environment variables:**
    -   Copy the example `.env` file:
        ```bash
        cp .env.example .env
        ```
    -   The default values should work for a local setup. `OLLAMA_HOST` is already set to `http://127.0.0.1:11434`.

5.  **Run database migrations:**
    ```bash
    alembic upgrade head
    ```

6.  **Run the backend server:**
    -   You can run the server using Uvicorn. It's recommended to run this in a separate terminal or using a process manager like `systemd` or `tmux`.
        ```bash
        uvicorn main:app --host 0.0.0.0 --port 8000
        ```

### 4. Frontend Setup

1.  **Navigate to the frontend directory** (from the project root):
    ```bash
    cd frontend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Build the static assets:**
    ```bash
    npm run build
    ```
    This will create a `dist` directory containing the compiled frontend application.

4.  **Configure Nginx:**
    -   Create a new Nginx configuration file:
        ```bash
        sudo nano /etc/nginx/sites-available/chat-app
        ```
    -   Add the following configuration, which is based on the project's `frontend/nginx.conf`:
        ```nginx
        server {
            listen 80;
            server_name your_domain_or_ip;

            root /path/to/your/project/frontend/dist;
            index index.html;

            location / {
                try_files $uri $uri/ /index.html;
            }

            location /api {
                proxy_pass http://127.0.0.1:8000;
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto $scheme;
            }
        }
        ```
    -   **Important:**
        -   Replace `your_domain_or_ip` with your server's public IP address or domain name.
        -   Replace `/path/to/your/project/frontend/dist` with the absolute path to the `frontend/dist` directory.
    -   Enable the site by creating a symbolic link:
        ```bash
        sudo ln -s /etc/nginx/sites-available/chat-app /etc/nginx/sites-enabled/
        ```
    -   Test the Nginx configuration and restart the service:
        ```bash
        sudo nginx -t
        sudo systemctl restart nginx
        ```

### 5. Access the Application

-   **Frontend:** Open your browser to `http://your_domain_or_ip`
-   **Backend API Docs:** `http://your_domain_or_ip:8000/docs`

Remember to deactivate the Python virtual environment (`deactivate`) when you are done.

## Known Issues

-   **Integration Tests:** The backend integration tests are currently non-functional due to a persistent issue with the test database environment. This is a known gap in test coverage.
-   **Token Counting:** The logic for estimating prompt tokens in `backend/llm.py` is a simple `len(text) // 4` heuristic. For a production environment, this should be replaced with a proper tokenizer library (e.g., `tiktoken`) for more accurate results.
