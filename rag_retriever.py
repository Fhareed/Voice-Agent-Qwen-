from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

embedding = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

def load_retriever(persist_path="rag_index"):
    return FAISS.load_local(persist_path, embedding, allow_dangerous_deserialization=True)