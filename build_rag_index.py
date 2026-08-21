# build_rag_index.py
import os

from langchain_community.vectorstores import FAISS

from document_loader import load_pdf, load_website, split_documents
from rag_retriever import embedding, refresh_fingerprint

# Set a polite user-agent BEFORE any web page is loaded below.
os.environ["USER_AGENT"] = "VoiceAgentBot/1.0"

# Load and split your documents
docs = load_pdf("example_docs/doc3.pdf") + load_website("https://www.linkedin.com/in/farid-oladega")
chunks = split_documents(docs)

# Build and save the FAISS index
db = FAISS.from_documents(chunks, embedding)
db.save_local("rag_index")

# Record a trusted fingerprint of the freshly built index (security guardrail).
refresh_fingerprint("rag_index")

print("✅ RAG index built and saved to ./rag_index")
