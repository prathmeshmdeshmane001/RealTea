import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from backend.models import QueryRequest
from backend.crag_engine import run_crag_pipeline

def test_crag_flow():
    print("==================================================")
    print("Testing RealTea Pipeline with Multiple Questions")
    print("==================================================")

    # Test 1: Internal textbook topic (expected CORRECT)
    q1 = "Batch normalization vs layer normalization"
    print(f"\n[TEST 1] Question: {q1}")
    req1 = QueryRequest(question=q1, model_provider="gemini", upper_th=0.7, lower_th=0.3, k=4)
    trace1 = run_crag_pipeline(req1)
    print(f"Verdict: {trace1.verdict}")
    print(f"Reason: {trace1.verdict_reason}")
    print(f"Path: {' -> '.join(trace1.execution_path)}")
    print(f"Answer snippet: {trace1.answer[:200]}...")
    assert trace1.answer, "Answer should not be empty"

    # Test 2: External recent news query (expected INCORRECT / Tavily Fallback)
    q2 = "Recent AI news from last week"
    print(f"\n[TEST 2] Question: {q2}")
    req2 = QueryRequest(question=q2, model_provider="gemini", upper_th=0.7, lower_th=0.3, k=4)
    trace2 = run_crag_pipeline(req2)
    print(f"Verdict: {trace2.verdict}")
    print(f"Reason: {trace2.verdict_reason}")
    print(f"Web Query: {trace2.web_query}")
    print(f"Web Docs Found: {len(trace2.web_docs)}")
    print(f"Path: {' -> '.join(trace2.execution_path)}")
    print(f"Answer snippet: {trace2.answer[:200]}...")
    assert trace2.answer, "Answer should not be empty"

    print("\n==================================================")
    print("All Pipeline Tests Completed Successfully! ✅")
    print("==================================================")

if __name__ == "__main__":
    test_crag_flow()
