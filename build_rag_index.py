# build_rag_index.py
from document_loader import split_documents
from rag_retriever import embedding
from langchain_community.vectorstores import FAISS
from pathlib import Path
import os

# Set user-agent for polite scraping
os.environ["USER_AGENT"] = "VoiceAgentBot/1.0"

# Load and split your documents
from document_loader import load_pdf, load_website
docs = load_pdf("example_docs/doc3.pdf") + load_website("https://www.linkedin.com/in/farid-oladega")
chunks = split_documents(docs)

# Build and save the FAISS index
db = FAISS.from_documents(chunks, embedding)
db.save_local("rag_index")
print("✅ RAG index built and saved to ./rag_index")