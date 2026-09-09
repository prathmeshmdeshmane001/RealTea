# RealTea Setup & Installation Guide

This guide walks you through setting up and running **RealTea** from scratch on macOS, Linux, or Windows (WSL2).

---

## 1. System Prerequisites

Ensure the following tools are installed on your workstation:

- **Python**: Version `3.10` or higher (`python3 --version`)
- **Node.js**: Version `18.0.0` or higher (`node --version`)
- **npm**: Version `9.0.0` or higher (`npm --version`)
- **Git**: Version `2.30+` (`git --version`)

---

## 2. Quickstart (One-Command Launch)

The easiest way to start RealTea is using the automated startup script:

```bash
# 1. Clone the repository
git clone https://github.com/your-username/RealTea.git
cd RealTea

# 2. Configure your environment variables
cp .env.example .env
# Edit .env and insert your API keys (at least OPENAI_API_KEY and GEMINI_API_KEY)

# 3. Make start.sh executable and launch
chmod +x start.sh
./start.sh
```

The script will automatically:
1. Create a Python virtual environment (`.venv`) if not present.
2. Install Python dependencies from `requirements.txt`.
3. Install frontend dependencies and build the production bundle (`npm install && npm run build`).
4. Initialize the FAISS vector index if cold-starting.
5. Launch the unified FastAPI web server on `http://localhost:8080`.

---

## 3. Manual Step-by-Step Installation

If you prefer to configure each component manually:

### 3.1. Backend Setup

```bash
# Navigate to the project root
cd RealTea

# Create and activate a Python virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Upgrade pip and install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

### 3.2. Frontend Setup

```bash
# Navigate to the frontend directory
cd frontend

# Install Node dependencies
npm install

# Build the production UI bundle
npm run build

# Return to root
cd ..
```

---

## 4. API Key Configuration

Copy `.env.example` to `.env` in the repository root:

```bash
cp .env.example .env
```

Open `.env` and fill in your credentials:

```ini
# Google Gemini API Key (Recommended default LLM engine)
# https://aistudio.google.com/app/apikey
GEMINI_API_KEY=AIzaSy...

# OpenAI API Key (Required for text-embedding-3-small and GPT-4o-mini)
# https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-...

# Tavily Search API Key (Required for live web search fallback)
# https://tavily.com/
TAVILY_API_KEY=tvly-...

# DeepSeek API Key (Optional)
# https://platform.deepseek.com/
DEEPSEEK_API_KEY=sk-...

# Host and Port Configuration
HOST=0.0.0.0
PORT=8080
```

> [!IMPORTANT]
> - `OPENAI_API_KEY` is required because document chunk embeddings use OpenAI's `text-embedding-3-small`.
> - `GEMINI_API_KEY` is recommended as the default generator and evaluator for ultra-low latency.
> - `TAVILY_API_KEY` is required for the web search fallback when document retrieval assigns `INCORRECT` or `AMBIGUOUS`.

---

## 5. Running the Application

### Production Mode (Single-Server SPA)
In production mode, FastAPI serves both the REST API and the compiled React SPA from `frontend/dist`:

```bash
source .venv/bin/activate
python3 -m uvicorn backend.server:app --host 0.0.0.0 --port 8080
```
Open **`http://localhost:8080`** in your browser.

### Development Mode (Hot-Reloading Frontend & Backend)

For frontend or backend development with Hot Module Replacement (HMR):

**Terminal 1 (Backend Server):**
```bash
source .venv/bin/activate
python3 -m uvicorn backend.server:app --host 0.0.0.0 --port 8080 --reload
```

**Terminal 2 (Vite Frontend Dev Server):**
```bash
cd frontend
npm run dev
```
Open the Vite dev server at **`http://localhost:5173`**. Requests to `/api/*` are automatically proxied to port `8080`.

---

## 6. Document Indexing & Storage

The system references three foundational product and technology texts located in `corrective-rag-main/documents/`:
- `book1.pdf`: *INSPIRED* (Marty Cagan)
- `book2.pdf`: *Crossing the Chasm* (Geoffrey Moore)
- `book3.pdf`: *Zero to One* (Peter Thiel)

To build or rebuild the FAISS vector index:

### Via REST API:
```bash
curl -X POST http://localhost:8080/api/documents/reindex
```

### Via Python:
```bash
source .venv/bin/activate
python3 -c "from backend.vector_store import build_vector_store; build_vector_store()"
```

The vectorized index is serialized to `storage/faiss_index/` (`index.faiss` and `index.pkl`) and loaded into memory in under 0.8 seconds on subsequent cold starts.

---

## 7. Running Tests

Run the integration test suite to verify pipeline retrieval, scoring, query rewriting, web search, and synthesis:

```bash
source .venv/bin/activate
python3 tests/test_crag.py
```

Expected output:
```
==================================================
Testing RealTea Pipeline with Multiple Questions
==================================================

[TEST 1] Question: Batch normalization vs layer normalization
Verdict: CORRECT
Path: retrieve -> eval_each_doc -> refine -> generate
...

[TEST 2] Question: Recent AI news from last week
Verdict: INCORRECT
Web Query: Recent AI news last week
Web Docs Found: 5
Path: retrieve -> eval_each_doc -> rewrite_query -> web_search -> refine -> generate
...
All Pipeline Tests Completed Successfully! ✅
```

---

## 8. Troubleshooting FAQ

#### Q: `ModuleNotFoundError: No module named 'backend'`
Make sure you run python commands from the repository root, or set `PYTHONPATH=.`.

#### Q: `Error: Port 8080 already in use`
Specify an alternative port in your `.env` file (e.g. `PORT=8000`) or pass it to uvicorn:
```bash
python3 -m uvicorn backend.server:app --port 8000
```

#### Q: `RuntimeError: OpenSSL / FAISS architecture mismatch on macOS`
If running on Apple Silicon (M1/M2/M3), ensure you install `faiss-cpu` inside an arm64 virtual environment:
```bash
pip install faiss-cpu==1.8.0
```

#### Q: Frontend shows `Backend Disconnected`
Ensure the FastAPI server is running on the port configured in `.env`. Check `/api/health` in your browser.
