FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (curl is required for high-speed robust REST transport)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code, documents, and reference files
COPY backend/ ./backend/
COPY corrective-rag-main/documents/ ./corrective-rag-main/documents/

# Pre-warm FAISS index on build if needed or on startup
ENV PORT=8080
ENV HOST=0.0.0.0

EXPOSE 8080

CMD ["python", "-m", "uvicorn", "backend.server:app", "--host", "0.0.0.0", "--port", "8080"]
