"""Builds the retrieval-augmented-generation (RAG) chain, modern LangChain style.

The old RetrievalQA helper was removed in LangChain 1.x, so we compose the chain
directly with LCEL (LangChain Expression Language). Give it a language model and
a retriever; you get back something you call with a question string and receive
an answer string.
"""
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough

_PROMPT = ChatPromptTemplate.from_template(
    "Use the context below to answer the question. "
    "If the answer is not in the context, say you don't know.\n\n"
    "Context:\n{context}\n\n"
    "Question: {question}\n"
    "Answer:"
)


def _format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)


def build_qa_chain(llm, retriever):
    """Compose retriever + prompt + llm into a question -> answer chain."""
    return (
        {"context": retriever | _format_docs, "question": RunnablePassthrough()}
        | _PROMPT
        | llm
        | StrOutputParser()
    )
