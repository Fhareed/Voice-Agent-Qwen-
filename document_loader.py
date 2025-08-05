from langchain_community.document_loaders import (
    PyPDFLoader,
    TextLoader,
    UnstructuredWordDocumentLoader,
    WebBaseLoader,
)
from langchain_community.document_loaders.recursive_url_loader import RecursiveUrlLoader

from langchain.text_splitter import RecursiveCharacterTextSplitter
from pathlib import Path
import os


def load_pdf(path):
    return PyPDFLoader(path).load()


def load_docx(path):
    return UnstructuredWordDocumentLoader(path).load()


def load_txt(path):
    return TextLoader(path, encoding='utf-8').load()


def load_website(url):
    # Use WebBaseLoader for static pages or RecursiveUrlLoader for full site crawling
    return WebBaseLoader(url).load()


def split_documents(documents):
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    return splitter.split_documents(documents)


if __name__ == "__main__":
    # Example files
    base_dir = "example_docs"
    pdf_docs = load_pdf(f"{base_dir}/doc3.pdf")
    #txt_docs = load_txt(f"{base_dir}/example.txt")
    #docx_docs = load_docx(f"{base_dir}/example.docx")
    web_docs = load_website("https://www.linkedin.com/in/farid-oladega")


    # Merge and split all
    all_docs = pdf_docs + web_docs
    chunks = split_documents(all_docs)

    print(f"✅ Loaded {len(all_docs)} raw docs → {len(chunks)} text chunks.")
    print(f"📄 Sample chunk:\n{chunks[0].page_content}")