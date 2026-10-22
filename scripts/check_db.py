"""Quick standalone check that the app can reach the Supabase database.

Run:  .venv/bin/python check_db.py
"""
from dotenv import load_dotenv

from db import db_health

if __name__ == "__main__":
    load_dotenv()
    print("Connecting to Supabase...")
    print("✅ Connected! Our tables are reachable:", db_health())
