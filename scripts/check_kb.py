"""Prove that each org's knowledge base is completely separate.

We build two pretend companies with different facts, then ask BOTH the same
question. Each must only ever see its OWN documents.

Run:  .venv/bin/python check_kb.py
"""
from dotenv import load_dotenv

from kb import build_index_for_org, get_retriever_for_org

if __name__ == "__main__":
    load_dotenv()

    ORG_A = "org-acme-test"
    ORG_B = "org-globex-test"

    print("1) Building two separate knowledge bases...")
    build_index_for_org(
        ORG_A,
        texts=[
            "Acme Corp's return policy is 30 days.",
            "Acme Corp headquarters is in Berlin.",
        ],
    )
    build_index_for_org(
        ORG_B,
        texts=[
            "Globex Inc's return policy is 90 days.",
            "Globex Inc headquarters is in Tokyo.",
        ],
    )

    print("2) Asking BOTH the same question, each scoped to its own org...")
    a_docs = get_retriever_for_org(ORG_A).invoke("What is the return policy?")
    b_docs = get_retriever_for_org(ORG_B).invoke("What is the return policy?")

    a_text = " ".join(d.page_content for d in a_docs)
    b_text = " ".join(d.page_content for d in b_docs)
    print(f"   Acme sees:   {[d.page_content for d in a_docs]}")
    print(f"   Globex sees: {[d.page_content for d in b_docs]}")

    print("3) Checking isolation...")
    assert "Acme" in a_text and "Globex" not in a_text, "Acme leaked Globex data!"
    assert "Globex" in b_text and "Acme" not in b_text, "Globex leaked Acme data!"
    print("✅ Isolation holds — neither org can see the other's documents.")
