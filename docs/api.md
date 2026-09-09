# RealTea REST API Reference

The **RealTea Studio API** provides programmatic access to the Corrective Retrieval-Augmented Generation pipeline, vector storage operations, and model configuration.

- **Base URL**: `http://localhost:8080/api`
- **Interactive Swagger Docs**: `http://localhost:8080/docs`
- **OpenAPI JSON Schema**: `http://localhost:8080/openapi.json`

---

## 1. System Health & Configuration

### `GET /api/health`
Checks backend readiness, vector store indexing status, and configured LLM providers.

#### Response (`200 OK`):
```json
{
  "status": "healthy",
  "openai_configured": true,
  "gemini_configured": true,
  "tavily_configured": true,
  "deepseek_configured": false,
  "vector_store_ready": true,
  "indexed_chunks": 1956
}
```

#### Example `curl`:
```bash
curl -X GET http://localhost:8080/api/health
```

---

### `GET /api/config`
Returns default threshold values, active model providers, and recommendation flags.

#### Response (`200 OK`):
```json
{
  "default_upper_th": 0.7,
  "default_lower_th": 0.3,
  "models": [
    {
      "id": "gemini",
      "name": "Google Gemini 3.5 Flash Lite",
      "recommended": true,
      "available": true
    },
    {
      "id": "openai",
      "name": "OpenAI GPT-4o-mini",
      "recommended": false,
      "available": true
    },
    {
      "id": "deepseek",
      "name": "DeepSeek Chat",
      "recommended": false,
      "available": false
    }
  ],
  "default_provider": "gemini"
}
```

#### Example `curl`:
```bash
curl -X GET http://localhost:8080/api/config
```

---

## 2. Document & Vector Store Operations

### `GET /api/documents`
Returns statistics on reference PDF volumes in `corrective-rag-main/documents/` and index status.

#### Response (`200 OK`):
```json
{
  "is_indexed": true,
  "total_documents": 3,
  "total_chunks": 1956,
  "documents": [
    {
      "filename": "book1.pdf",
      "size_bytes": 2744274,
      "page_count": 370,
      "chunks_count": 820
    },
    {
      "filename": "book2.pdf",
      "size_bytes": 32230978,
      "page_count": 279,
      "chunks_count": 640
    },
    {
      "filename": "book3.pdf",
      "size_bytes": 2664921,
      "page_count": 186,
      "chunks_count": 496
    }
  ],
  "index_path": ".../storage/faiss_index"
}
```

#### Example `curl`:
```bash
curl -X GET http://localhost:8080/api/documents
```

---

### `POST /api/documents/reindex`
Triggers an asynchronous rebuild of the FAISS vector index from disk PDFs.

#### Response (`200 OK`):
```json
{
  "status": "success",
  "message": "Reindexed 3 documents into 1,956 chunks successfully.",
  "total_chunks": 1956
}
```

#### Example `curl`:
```bash
curl -X POST http://localhost:8080/api/documents/reindex
```

---

## 3. Corrective RAG Pipeline Execution

### `POST /api/crag/query`
Executes the full 6-stage LangGraph StateGraph pipeline for a user question.

#### Request Body (`application/json`):

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :---: | :---: | :--- |
| `question` | `string` | **Yes** | — | The question to submit to the CRAG pipeline. |
| `model_provider` | `string` | No | `"gemini"` | LLM provider: `"gemini"`, `"openai"`, or `"deepseek"`. |
| `upper_th` | `float` | No | `0.7` | Confidence threshold above which chunk triggers `CORRECT` verdict. |
| `lower_th` | `float` | No | `0.3` | Confidence threshold below which chunk triggers `INCORRECT` verdict. |
| `k` | `int` | No | `4` | Number of chunks retrieved from FAISS (range: 2 to 8). |

#### Request Example:
```json
{
  "question": "What is product discovery according to Marty Cagan?",
  "model_provider": "gemini",
  "upper_th": 0.7,
  "lower_th": 0.3,
  "k": 4
}
```

#### Response Body (`200 OK` - `CRAGTrace` schema):
```json
{
  "question": "What is product discovery according to Marty Cagan?",
  "model_used": "Google Gemini 3.5 Flash Lite",
  "verdict": "CORRECT",
  "verdict_reason": "Evaluator confirmed 3 chunks exceed confidence upper threshold 0.7.",
  "execution_path": [
    "retrieve",
    "eval_each_doc",
    "refine",
    "generate"
  ],
  "duration_ms": 1240.5,
  "doc_evaluations": [
    {
      "chunk_index": 0,
      "source": "book1.pdf",
      "page": 42,
      "score": 0.88,
      "reason": "Explicitly details product discovery as discovering a product that is valuable, usable, feasible, and viable.",
      "passed_lower": true,
      "passed_upper": true,
      "content": "Product discovery is the iterative process of discovering what to build..."
    }
  ],
  "all_strips": [
    "Product discovery is the iterative process of discovering what to build.",
    "It requires testing four critical risks: value risk, usability risk, feasibility risk, and business viability risk."
  ],
  "kept_strips": [
    "Product discovery is the iterative process of discovering what to build.",
    "It requires testing four critical risks: value risk, usability risk, feasibility risk, and business viability risk."
  ],
  "web_query": null,
  "web_docs": [],
  "refined_context": "Product discovery is the iterative process of discovering what to build. It requires testing four critical risks: value risk, usability risk, feasibility risk, and business viability risk.",
  "answer": "According to Marty Cagan in INSPIRED, product discovery is the continuous process of discovering what to build. It focuses on addressing four critical product risks upfront: value risk (whether customers will buy it), usability risk (whether users can figure out how to use it), feasibility risk (whether engineers can build it), and business viability risk (whether it works for the business)."
}
```

#### Fallback Web Query Response Example (`verdict: "INCORRECT"`):
When the question is outside the scope of the three reference books:
```json
{
  "question": "Recent AI breakthroughs from last week",
  "model_used": "Google Gemini 3.5 Flash Lite",
  "verdict": "INCORRECT",
  "verdict_reason": "No document chunks exceeded lower threshold 0.3. Discarded internal corpus and triggered Tavily web search.",
  "execution_path": [
    "retrieve",
    "eval_each_doc",
    "rewrite_query",
    "web_search",
    "refine",
    "generate"
  ],
  "web_query": "Recent AI breakthroughs research news last 30 days",
  "web_docs": [
    {
      "title": "AI Weekly Roundup - Emerging Models",
      "url": "https://example.com/ai-weekly",
      "snippet": "New open-weights models and reasoning frameworks announced..."
    }
  ],
  "answer": "Based on recent search findings, key breakthroughs include..."
}
```

#### Example `curl`:
```bash
curl -X POST http://localhost:8080/api/crag/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is crossing the chasm and the technology adoption lifecycle?",
    "model_provider": "gemini",
    "upper_th": 0.7,
    "lower_th": 0.3,
    "k": 4
  }'
```

---

## 4. Error Responses

| Status Code | Reason | Example Response |
| :---: | :--- | :--- |
| `400 Bad Request` | Missing required query text or invalid threshold configuration | `{"detail": "Question string cannot be empty"}` |
| `422 Unprocessable` | JSON payload validation error (e.g. non-numeric threshold) | `{"detail": [{"loc": ["body", "upper_th"], "msg": "value is not a valid float"}]}` |
| `500 Server Error` | Upstream provider outage or missing API credentials | `{"detail": "Gemini API key not configured in environment"}` |
