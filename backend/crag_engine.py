import os
import re
import json
import time
import httpx
from typing import List, TypedDict, Optional, Dict, Any
from pydantic import BaseModel

from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, START, END

from backend.config import OPENAI_API_KEY, GEMINI_API_KEY, TAVILY_API_KEY, DEEPSEEK_API_KEY, DEFAULT_UPPER_TH, DEFAULT_LOWER_TH
from backend.vector_store import get_retriever
from backend.models import DocEvaluationItem, WebSearchResultItem, CRAGTrace, QueryRequest

# -----------------------------
# Structured Output Schemas (Notebook 3 & 5 & 6)
# -----------------------------
class DocEvalScore(BaseModel):
    chunk_index: int
    score: float
    reason: str

class AllChunkEvals(BaseModel):
    evaluations: List[DocEvalScore]

class KeepOrDropBatch(BaseModel):
    kept_indices: List[int]

class WebQuery(BaseModel):
    query: str

# -----------------------------
# LangGraph State Schema (Notebook 6)
# -----------------------------
class State(TypedDict):
    question: str
    docs: List[Document]
    good_docs: List[Document]
    doc_evals: List[DocEvaluationItem]
    verdict: str
    reason: str
    strips: List[str]
    kept_strips: List[str]
    refined_context: str
    web_query: str
    web_docs: List[Document]
    answer: str
    execution_path: List[str]
    # Configurable params
    provider: str
    upper_th: float
    lower_th: float
    k: int

# -----------------------------
# Gemini High-Speed HTTP/1.1 Persistent REST Client
# -----------------------------
_gemini_client: Optional[httpx.Client] = None

def get_gemini_client() -> httpx.Client:
    global _gemini_client
    if _gemini_client is None or _gemini_client.is_closed:
        _gemini_client = httpx.Client(
            http2=False,
            timeout=15.0,
            limits=httpx.Limits(max_keepalive_connections=10, max_connections=20)
        )
    return _gemini_client

def _call_gemini_api(contents_text: str, json_mode: bool = False, model: str = "gemini-3.5-flash-lite", max_tokens: int = 1500) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
    actual_tokens = max(max_tokens, 600)
    payload = {
        "contents": [{"parts": [{"text": contents_text}]}],
        "generationConfig": {
            "temperature": 0.0 if json_mode else 0.2,
            "maxOutputTokens": actual_tokens
        }
    }
    if json_mode:
        payload["generationConfig"]["response_mime_type"] = "application/json"

    def _extract_text(data: dict) -> Optional[str]:
        if "candidates" in data and data["candidates"]:
            cand = data["candidates"][0]
            parts = cand.get("content", {}).get("parts", [])
            text_parts = [p["text"] for p in parts if isinstance(p, dict) and "text" in p and p["text"]]
            if text_parts:
                return "".join(text_parts)
        return None

    # 1. Primary: High-speed curl subprocess (immune to macOS Python OpenSSL/TLS read timeouts)
    try:
        import subprocess
        cmd = [
            "curl", "-s", "--http1.1", "-m", "25", "-X", "POST", url,
            "-H", "Content-Type: application/json",
            "-d", json.dumps(payload)
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0 and res.stdout:
            data = json.loads(res.stdout)
            extracted = _extract_text(data)
            if extracted is not None:
                return extracted
            elif "error" in data:
                print(f"[Gemini API returned error: {data['error'].get('message')}]")
    except Exception as e:
        print(f"[Gemini curl error: {e}]")

    # 2. Fallback: httpx
    client = get_gemini_client()
    for attempt in range(2):
        try:
            resp = client.post(url, json=payload, timeout=30.0)
            if resp.status_code == 429:
                time.sleep(0.5 * (attempt + 1))
                continue
            resp.raise_for_status()
            data = resp.json()
            extracted = _extract_text(data)
            if extracted is not None:
                return extracted
        except Exception as e:
            if attempt == 1:
                raise e
            time.sleep(0.5)

    raise RuntimeError("Gemini API call failed after retries")

# -----------------------------
# Unified LLM Caller (OpenAI / Gemini / DeepSeek)
# -----------------------------
def call_llm_structured(schema: type[BaseModel], system_prompt: str, human_prompt: str, provider: str = "gemini", max_tokens: int = 600) -> BaseModel:
    """Invokes LLM with guaranteed structured JSON matching the Pydantic schema."""
    providers_to_try = [provider]
    for alt in ["gemini", "openai", "deepseek"]:
        if alt not in providers_to_try:
            providers_to_try.append(alt)

    last_error = None
    for p in providers_to_try:
        try:
            if p == "gemini" and GEMINI_API_KEY:
                full_prompt = (
                    f"{system_prompt}\n\n"
                    f"{human_prompt}\n\n"
                    f"Return ONLY valid JSON matching this schema: {json.dumps(schema.model_json_schema())}."
                )
                text = _call_gemini_api(full_prompt, json_mode=True, max_tokens=max_tokens)
                clean_text = re.sub(r"^```json\s*", "", text.strip())
                clean_text = re.sub(r"\s*```$", "", clean_text)
                return schema.model_validate_json(clean_text)

            elif p == "openai" and OPENAI_API_KEY:
                from langchain_openai import ChatOpenAI
                llm = ChatOpenAI(model="gpt-4o-mini", api_key=OPENAI_API_KEY, temperature=0, max_retries=0)
                prompt = ChatPromptTemplate.from_messages([
                    ("system", system_prompt),
                    ("human", "{input_text}")
                ])
                chain = prompt | llm.with_structured_output(schema)
                return chain.invoke({"input_text": human_prompt})

            elif p == "deepseek" and DEEPSEEK_API_KEY:
                from langchain_openai import ChatOpenAI
                llm = ChatOpenAI(
                    model="deepseek-chat",
                    api_key=DEEPSEEK_API_KEY,
                    base_url="https://api.deepseek.com",
                    temperature=0,
                    max_retries=0
                )
                prompt = ChatPromptTemplate.from_messages([
                    ("system", system_prompt),
                    ("human", "{input_text}")
                ])
                chain = prompt | llm.with_structured_output(schema)
                return chain.invoke({"input_text": human_prompt})

        except Exception as e:
            last_error = e
            continue

    raise RuntimeError(f"All LLM structured output providers failed. Last error: {last_error}")

def call_llm_text(system_prompt: str, human_prompt: str, provider: str = "gemini", max_tokens: int = 1500) -> str:
    """Invokes LLM for freeform text generation."""
    providers_to_try = [provider]
    for alt in ["gemini", "openai", "deepseek"]:
        if alt not in providers_to_try:
            providers_to_try.append(alt)

    last_error = None
    for p in providers_to_try:
        try:
            if p == "gemini" and GEMINI_API_KEY:
                full_prompt = f"{system_prompt}\n\n{human_prompt}"
                return _call_gemini_api(full_prompt, json_mode=False, max_tokens=max_tokens).strip()

            elif p == "openai" and OPENAI_API_KEY:
                from langchain_openai import ChatOpenAI
                llm = ChatOpenAI(model="gpt-4o-mini", api_key=OPENAI_API_KEY, temperature=0, max_retries=0)
                prompt = ChatPromptTemplate.from_messages([
                    ("system", system_prompt),
                    ("human", "{input_text}")
                ])
                res = (prompt | llm).invoke({"input_text": human_prompt})
                return res.content.strip()

            elif p == "deepseek" and DEEPSEEK_API_KEY:
                from langchain_openai import ChatOpenAI
                llm = ChatOpenAI(
                    model="deepseek-chat",
                    api_key=DEEPSEEK_API_KEY,
                    base_url="https://api.deepseek.com",
                    temperature=0,
                    max_retries=0
                )
                prompt = ChatPromptTemplate.from_messages([
                    ("system", system_prompt),
                    ("human", "{input_text}")
                ])
                res = (prompt | llm).invoke({"input_text": human_prompt})
                return res.content.strip()

        except Exception as e:
            last_error = e
            continue

    raise RuntimeError(f"All LLM text generation providers failed. Last error: {last_error}")

# -----------------------------
# Sentence-Level Decomposer (Notebook 2 & 6)
# -----------------------------
def decompose_to_sentences(text: str) -> List[str]:
    text = re.sub(r"\s+", " ", text).strip()
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return [s.strip() for s in sentences if len(s.strip()) > 20]

# -----------------------------
# CRAG Nodes Implementation
# -----------------------------
def retrieve_node(state: State) -> Dict[str, Any]:
    q = state["question"]
    k = state.get("k", 4)
    print(f"--> [CRAG Node] retrieve: searching top-{k} chunks for '{q[:40]}...'...", flush=True)
    retriever = get_retriever(k=k)
    docs = retriever.invoke(q)
    print(f"--> [CRAG Node] retrieve DONE: retrieved {len(docs)} chunks", flush=True)
    exec_path = state.get("execution_path", []) + ["retrieve"]
    return {"docs": docs, "execution_path": exec_path}

def eval_each_doc_node(state: State) -> Dict[str, Any]:
    q = state["question"]
    provider = state.get("provider", "gemini")
    upper_th = state.get("upper_th", DEFAULT_UPPER_TH)
    lower_th = state.get("lower_th", DEFAULT_LOWER_TH)
    docs = state.get("docs", [])
    print(f"--> [CRAG Node] eval_each_doc: evaluating {len(docs)} chunks with provider={provider}...", flush=True)

    system_prompt = (
        "You are a strict retrieval evaluator for RAG.\n"
        "You will be given retrieved chunks and a question.\n"
        "For EACH chunk, return a relevance score in [0.0, 1.0].\n"
        "- 1.0: chunk alone is sufficient to answer fully/mostly\n"
        "- 0.0: chunk is irrelevant\n"
        "Be conservative with high scores. Return chunk_index, score, and short reason for each."
    )

    chunks_formatted = "\n\n".join(
        f"--- CHUNK {i+1} ---\n{d.page_content[:600]}" for i, d in enumerate(docs)
    )
    human_prompt = f"Question: {q}\n\nCandidate Chunks:\n{chunks_formatted}"

    eval_items: List[DocEvaluationItem] = []
    good: List[Document] = []
    scores: List[float] = []

    try:
        out: AllChunkEvals = call_llm_structured(AllChunkEvals, system_prompt, human_prompt, provider=provider, max_tokens=800)
        score_map = {e.chunk_index: e for e in out.evaluations}
    except Exception as e:
        print(f"--> [CRAG Node] eval_each_doc error: {e}", flush=True)
        score_map = {}

    for i, d in enumerate(docs):
        entry = score_map.get(i + 1)
        score = float(entry.score) if entry else 0.0
        reason = str(entry.reason) if entry else "Default relevance assessment"
        
        scores.append(score)
        passed_lower = score > lower_th
        passed_upper = score > upper_th

        if passed_lower:
            good.append(d)

        eval_items.append(DocEvaluationItem(
            chunk_index=i + 1,
            content=d.page_content[:400] + ("..." if len(d.page_content) > 400 else ""),
            source=d.metadata.get("source", f"Doc {i+1}"),
            page=d.metadata.get("page", None),
            score=round(score, 3),
            reason=reason,
            passed_lower=passed_lower,
            passed_upper=passed_upper,
        ))

    exec_path = state.get("execution_path", []) + ["eval_each_doc"]

    # Decision logic (Notebook 3 & 6)
    if any(s > upper_th for s in scores):
        verdict, reason = "CORRECT", f"At least one retrieved chunk scored > {upper_th}."
    elif len(scores) > 0 and all(s < lower_th for s in scores):
        verdict, reason = "INCORRECT", f"All retrieved chunks scored < {lower_th}."
        good = []
    else:
        verdict, reason = "AMBIGUOUS", f"No chunk scored > {upper_th}, but not all were < {lower_th}."

    print(f"--> [CRAG Node] eval_each_doc DONE: verdict={verdict}, scores={[round(s,2) for s in scores]}", flush=True)
    return {
        "good_docs": good,
        "doc_evals": eval_items,
        "verdict": verdict,
        "reason": reason,
        "execution_path": exec_path,
    }

def route_after_eval(state: State) -> str:
    if state["verdict"] == "CORRECT":
        return "refine"
    else:
        return "rewrite_query"
# -----------------------------
# Robust Tavily Web Search (Subprocess curl + httpx fallback)
# -----------------------------
def search_tavily(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """Fetches web search results reliably, utilizing curl subprocess to prevent macOS Python TLS ConnectionResetError."""
    if not TAVILY_API_KEY:
        return []

    # 1. Primary: curl subprocess (immune to Python urllib3 TLS handshake drops on macOS)
    try:
        import subprocess
        cmd = [
            "curl", "-s", "-m", "12", "-X", "POST", "https://api.tavily.com/search",
            "-H", "Content-Type: application/json",
            "-d", json.dumps({"api_key": TAVILY_API_KEY, "query": query, "max_results": max_results})
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0 and res.stdout:
            data = json.loads(res.stdout)
            results = data.get("results", [])
            if results:
                return results
    except Exception as e:
        print(f"[Tavily curl method error: {e}]")

    # 2. Fallback: httpx
    try:
        with httpx.Client(timeout=10.0, http2=False) as client:
            resp = client.post(
                "https://api.tavily.com/search",
                json={"api_key": TAVILY_API_KEY, "query": query, "max_results": max_results}
            )
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                if results:
                    return results
    except Exception as e:
        print(f"[Tavily httpx fallback error: {e}]")

    # 3. Fallback: TavilyClient SDK
    try:
        from tavily import TavilyClient
        tavily = TavilyClient(api_key=TAVILY_API_KEY)
        data = tavily.search(query=query, max_results=max_results)
        return data.get("results", [])
    except Exception as e:
        print(f"[Tavily SDK fallback error: {e}]")

    return []

def rewrite_query_node(state: State) -> Dict[str, Any]:
    q = state["question"]
    provider = state.get("provider", "gemini")
    print(f"--> [CRAG Node] rewrite_query: reformulating query for '{q[:40]}...'...", flush=True)

    system_prompt = (
        "You are a web search query reformulation engine.\n"
        "Extract the core factual entities, product names, technologies, and topics from the user's question into a concise keyword search query (3 to 8 words).\n"
        "Focus strictly on finding the facts or news needed (e.g. entity name, release, capabilities, specs).\n"
        "Strip away conversational framing like 'if you were the PM', 'what would you build', 'explain to me', or 'can you tell me'.\n"
        "If recency or latest release is mentioned or implied, add '(last 30 days)' or 'latest announcement'.\n"
        "Do NOT answer the question. Return ONLY the search query."
    )
    human_prompt = f"Question: {q}"

    try:
        out: WebQuery = call_llm_structured(WebQuery, system_prompt, human_prompt, provider=provider, max_tokens=500)
        web_query = out.query.strip()
    except Exception as e:
        print(f"--> [CRAG Node] rewrite_query error: {e}", flush=True)
        web_query = q

    print(f"--> [CRAG Node] rewrite_query DONE: query='{web_query}'", flush=True)
    exec_path = state.get("execution_path", []) + ["rewrite_query"]
    return {"web_query": web_query, "execution_path": exec_path}

def web_search_node(state: State) -> Dict[str, Any]:
    q = state.get("web_query") or state["question"]
    print(f"--> [CRAG Node] web_search: searching Tavily for '{q}'...", flush=True)
    web_docs: List[Document] = []

    try:
        results = search_tavily(query=q, max_results=5)
        for r in results:
            title = r.get("title", "Web Result")
            url = r.get("url", "")
            content = r.get("content", "")
            text = f"TITLE: {title}\nURL: {url}\nCONTENT:\n{content}"
            web_docs.append(Document(page_content=text, metadata={"url": url, "title": title, "source": "Tavily Web Search"}))
    except Exception as e:
        print(f"--> [CRAG Node] Tavily search error: {e}", flush=True)

    print(f"--> [CRAG Node] web_search DONE: retrieved {len(web_docs)} web docs", flush=True)
    exec_path = state.get("execution_path", []) + ["web_search"]
    return {"web_docs": web_docs, "execution_path": exec_path}

def refine(state: State) -> Dict[str, Any]:
    q = state["question"]
    provider = state.get("provider", "gemini")
    verdict = state.get("verdict", "CORRECT")

    if verdict == "CORRECT":
        docs_to_use = state.get("good_docs", [])
    elif verdict == "INCORRECT":
        docs_to_use = state.get("web_docs", [])
    else:  # AMBIGUOUS
        docs_to_use = state.get("good_docs", []) + state.get("web_docs", [])

    context = "\n\n".join(d.page_content for d in docs_to_use).strip()
    strips = decompose_to_sentences(context)
    print(f"--> [CRAG Node] refine: decomposed context into {len(strips)} sentence strips...", flush=True)

    # Fast-path: If sentences are already compact (<= 6 strips), keep directly to eliminate unnecessary LLM latency
    if len(strips) <= 6:
        kept = strips
        print(f"--> [CRAG Node] refine fast-path: {len(strips)} <= 6, kept all directly", flush=True)
    else:
        # Filter strips using single structured batch call
        eval_strips = strips[:15]
        system_prompt = (
            "You are a relevance filter for RAG.\n"
            "Given candidate sentences numbered 0 to N-1, return kept_indices: list of integer indices for sentences that contain useful facts, capabilities, definitions, or context related to the question."
        )
        formatted_strips = "\n".join(f"[{i}]: {s}" for i, s in enumerate(eval_strips))
        human_prompt = f"Question: {q}\n\nSentences:\n{formatted_strips}"

        kept: List[str] = []
        try:
            filter_res: KeepOrDropBatch = call_llm_structured(KeepOrDropBatch, system_prompt, human_prompt, provider=provider, max_tokens=600)
            for idx in filter_res.kept_indices:
                if 0 <= idx < len(eval_strips):
                    kept.append(eval_strips[idx])
        except Exception as e:
            print(f"--> [CRAG Node] refine LLM error: {e}", flush=True)
            kept = eval_strips[:5]

        # Fallback if all dropped or filter dropped everything
        if not kept and strips:
            kept = strips[:5]

    refined_context = "\n".join(kept).strip()
    print(f"--> [CRAG Node] refine DONE: kept {len(kept)} strips", flush=True)
    exec_path = state.get("execution_path", []) + ["refine"]

    return {
        "strips": strips,
        "kept_strips": kept,
        "refined_context": refined_context,
        "execution_path": exec_path,
    }

def generate(state: State) -> Dict[str, Any]:
    q = state["question"]
    provider = state.get("provider", "gemini")
    refined_context = state.get("refined_context", "")
    print(f"--> [CRAG Node] generate: synthesizing final response with provider={provider}...", flush=True)

    system_prompt = (
        "You are an expert AI Product Manager and ML tutor.\n"
        "Ground your response in the verified facts and technical capabilities from the provided context.\n"
        "If the user asks an analytical, strategic, or product question, use the technical capabilities, features, and context as the concrete foundation for your answer.\n"
        "If the context is completely empty and no information is available, say: 'I don't know.'\n"
        "Provide a clear, well-structured, insightful explanation."
    )
    human_prompt = f"Question: {q}\n\nRefined Context:\n{refined_context}"

    try:
        answer = call_llm_text(system_prompt, human_prompt, provider=provider, max_tokens=1200)
    except Exception as e:
        answer = f"Generation error: {e}"

    print(f"--> [CRAG Node] generate DONE: answer length={len(answer)} chars", flush=True)
    exec_path = state.get("execution_path", []) + ["generate"]
    return {"answer": answer, "execution_path": exec_path}

# -----------------------------
# StateGraph Assembly (Notebook 6)
# -----------------------------
def build_crag_graph():
    g = StateGraph(State)
    g.add_node("retrieve", retrieve_node)
    g.add_node("eval_each_doc", eval_each_doc_node)
    g.add_node("rewrite_query", rewrite_query_node)
    g.add_node("web_search", web_search_node)
    g.add_node("refine", refine)
    g.add_node("generate", generate)

    g.add_edge(START, "retrieve")
    g.add_edge("retrieve", "eval_each_doc")

    g.add_conditional_edges(
        "eval_each_doc",
        route_after_eval,
        {
            "refine": "refine",
            "rewrite_query": "rewrite_query",
        },
    )

    g.add_edge("rewrite_query", "web_search")
    g.add_edge("web_search", "refine")
    g.add_edge("refine", "generate")
    g.add_edge("generate", END)

    return g.compile()

crag_app = build_crag_graph()

def run_crag_pipeline(req: QueryRequest) -> CRAGTrace:
    start_time = time.time()
    provider = req.get_provider()

    initial_state: State = {
        "question": req.question,
        "docs": [],
        "good_docs": [],
        "doc_evals": [],
        "verdict": "",
        "reason": "",
        "strips": [],
        "kept_strips": [],
        "refined_context": "",
        "web_query": "",
        "web_docs": [],
        "answer": "",
        "execution_path": [],
        "provider": provider,
        "upper_th": req.upper_th,
        "lower_th": req.lower_th,
        "k": req.k,
    }

    result = crag_app.invoke(initial_state)
    duration_ms = round((time.time() - start_time) * 1000, 2)

    # Format web docs
    web_items: List[WebSearchResultItem] = []
    for d in result.get("web_docs", []):
        web_items.append(WebSearchResultItem(
            title=d.metadata.get("title", "Web Result"),
            url=d.metadata.get("url", ""),
            snippet=d.page_content[:300]
        ))

    # Format retrieved docs
    retrieved_summary = []
    for d in result.get("docs", []):
        retrieved_summary.append({
            "source": d.metadata.get("source", "PDF Chunk"),
            "page": d.metadata.get("page", 0),
            "content": d.page_content[:300] + "..."
        })

    return CRAGTrace(
        question=req.question,
        model_used=provider,
        retrieved_docs=retrieved_summary,
        doc_evaluations=result.get("doc_evals", []),
        verdict=result.get("verdict", "CORRECT"),
        verdict_reason=result.get("reason", ""),
        web_query=result.get("web_query", None),
        web_docs=web_items,
        all_strips=result.get("strips", []),
        kept_strips=result.get("kept_strips", []),
        refined_context=result.get("refined_context", ""),
        answer=result.get("answer", ""),
        execution_path=result.get("execution_path", []),
        duration_ms=duration_ms,
    )
