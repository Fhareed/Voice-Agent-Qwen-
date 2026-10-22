"""Load raw documents (PDF, Word, text, web pages) and split them into chunks.

Each file-format loader is imported LAZILY, inside the function that uses it, so
that importing this module (or just using split_documents) doesn't drag in every
loader's dependencies (pypdf, unstructured, beautifulsoup4, ...).
"""
try:
    # LangChain 0.2+ / 1.x: the text splitters live in their own package.
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError:  # older LangChain versions
    from langchain.text_splitter import RecursiveCharacterTextSplitter


def load_pdf(path):
    from langchain_community.document_loaders import PyPDFLoader

    return PyPDFLoader(path).load()


def load_docx(path):
    from langchain_community.document_loaders import UnstructuredWordDocumentLoader

    return UnstructuredWordDocumentLoader(path).load()


def load_txt(path):
    from langchain_community.document_loaders import TextLoader

    return TextLoader(path, encoding="utf-8").load()


def load_website(url):
    # Use WebBaseLoader for static pages or RecursiveUrlLoader for full site crawling
    from langchain_community.document_loaders import WebBaseLoader

    return WebBaseLoader(url).load()


def split_documents(documents):
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    return splitter.split_documents(documents)


if __name__ == "__main__":
    # Example files
    base_dir = "example_docs"
    pdf_docs = load_pdf(f"{base_dir}/doc3.pdf")
    # txt_docs = load_txt(f"{base_dir}/example.txt")
    # docx_docs = load_docx(f"{base_dir}/example.docx")
    web_docs = load_website("https://www.linkedin.com/in/farid-oladega")

    # Merge and split all
    all_docs = pdf_docs + web_docs
    chunks = split_documents(all_docs)

    print(f"✅ Loaded {len(all_docs)} raw docs → {len(chunks)} text chunks.")
    print(f"📄 Sample chunk:\n{chunks[0].page_content}")
