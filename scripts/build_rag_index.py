# build_rag_index.py
"""Build a knowledge base for ONE organization from example documents.

This used to build a single shared index. Now that the knowledge base is
per-tenant, it builds into a specific org's folder instead.

    python build_rag_index.py                 # uses DEMO_ORG_ID below
    DEMO_ORG_ID=<some-org-uuid> python build_rag_index.py
"""
import os

from kb import build_index_for_org

# Set a polite user-agent BEFORE any web page is loaded.
os.environ["USER_AGENT"] = "VoiceAgentBot/1.0"

DEMO_ORG_ID = os.getenv("DEMO_ORG_ID", "demo-org")

n = build_index_for_org(
    DEMO_ORG_ID,
    file_paths=["example_docs/doc3.pdf"],
    urls=["https://www.linkedin.com/in/farid-oladega"],
)

print(f"✅ Built knowledge base for org '{DEMO_ORG_ID}' — {n} chunks indexed.")
