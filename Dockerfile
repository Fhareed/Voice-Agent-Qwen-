# ── Voice Agent web app (FastAPI) ──────────────────────────────────────────
# A "container image" is a sealed box holding your app + the exact Python and
# libraries it needs, so it runs identically on your laptop, a teammate's
# machine, or a cloud server.

# Start from a small, official Python 3.10 image.
FROM python:3.10-slim

# System libraries a few audio/ML packages rely on.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies FIRST (this layer is cached and only re-runs when
# requirements.txt changes, which makes rebuilds much faster).
COPY requirements.txt .
# Install the CPU-only build of PyTorch up front, so the big NVIDIA CUDA/GPU
# packages aren't pulled onto a server that has no GPU (keeps the image lean).
# --extra-index-url keeps normal PyPI available for torch's small build deps.
RUN pip install --no-cache-dir torch \
        --index-url https://download.pytorch.org/whl/cpu \
        --extra-index-url https://pypi.org/simple
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code in.
COPY . .

# The web server listens on port 8000.
EXPOSE 8000

# Default command: start the FastAPI app.
# Honor the hosting platform's $PORT (Render/Fly inject it); fall back to 8000 locally.
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]
