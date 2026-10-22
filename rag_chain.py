"""Builds the retrieval-augmented-generation (RAG) chain, modern LangChain style.

The old RetrievalQA helper was removed in LangChain 1.x, so we compose the chain
directly with LCEL (LangChain Expression Language). Give it a language model and
a retriever; you call it with {"question": ..., "history": ...} (a bare string
still works too, with empty history) and get an answer string back.

The `history` is what makes it hold a real conversation: without it the model
answers every sentence in isolation and forgets it was mid-booking a second ago.
"""
from operator import itemgetter

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableLambda

_PROMPT = ChatPromptTemplate.from_template(
    "You're the friendly receptionist on the phone for a local service business. This "
    "is ONE ongoing call - the conversation so far is below. Keep it going naturally; "
    "never restart or re-introduce yourself, and always use what's already been said.\n\n"
    "Sound like a real person:\n"
    "- One short, natural sentence. Vary your wording; don't lean on 'sure thing' or "
    "'got it'.\n"
    "- Be helpful first - just answer what they ask. You do NOT need to collect a pile "
    "of details, and you should never feel like a form.\n\n"
    "If they want to book or schedule a visit:\n"
    "- All you really need is their phone number and a rough idea of when. That's plenty "
    "- tell them someone will call to confirm the details.\n"
    "- NEVER ask for the same thing twice. If they already said it, give a short or vague "
    "answer, or sound annoyed, do NOT ask again - piece together what they've said (for "
    "example '9' then 'tonight' means 9 tonight) and just go with it.\n"
    "- If you're missing something or they're getting frustrated, don't grill them - say "
    "no problem and that someone will call them right back to sort out the details, then "
    "let the call wind down.\n"
    "- Once you've got enough, confirm it in ONE short sentence and wrap up warmly; don't "
    "keep re-reading the whole booking back.\n\n"
    "Prices: only quote numbers that are in the info, casually. Don't add a disclaimer "
    "every time - only if they push for an exact final total. Don't haggle; if pushed, "
    "say the team will go over options. If a price isn't listed, say someone will confirm.\n\n"
    "Only say what's in the business info below - never invent anything. If you don't "
    "know something, say so and offer to take a message.\n\n"
    "Conversation so far:\n{history}\n\n"
    "Business info:\n{context}\n\n"
    "Caller just said: {question}\n"
    "You (one short, natural line):"
)


def _format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)


def _as_inputs(x):
    """Accept either a bare question string or {'question':..., 'history':...}."""
    if isinstance(x, str):
        return {"question": x, "history": ""}
    return {
        "question": x.get("question", ""),
        "history": x.get("history", "") or "(this is the start of the call)",
    }


def build_qa_chain(llm, retriever):
    """Compose retriever + prompt + llm into a (question, history) -> answer chain."""
    return (
        RunnableLambda(_as_inputs)
        | {
            "context": itemgetter("question") | retriever | _format_docs,
            "question": itemgetter("question"),
            "history": itemgetter("history"),
        }
        | _PROMPT
        | llm
        | StrOutputParser()
    )
