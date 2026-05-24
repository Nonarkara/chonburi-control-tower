FROM python:3.11-slim

WORKDIR /app

# System deps for asyncpg build
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libssl-dev libffi-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# CPU-only torch to keep image lean (~2 GB vs 4 GB GPU build)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

# HuggingFace cache persisted via Render disk or Docker volume
ENV HF_HOME=/data/hf_cache

EXPOSE 8000
CMD ["python", "main.py"]
