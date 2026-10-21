FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Non-root user for safer container runtime.
RUN groupadd -r appuser \
    && useradd -r -g appuser -d /app -s /usr/sbin/nologin appuser

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Create writable dirs up front. Observability writes to /app/logs/app.log
# (relative path: "logs/" with WORKDIR=/app) and FastF1 cache writes to /app/cache.
RUN mkdir -p /app/cache /app/logs \
    && chown -R appuser:appuser /app/cache /app/logs \
    && chmod -R 775 /app/cache

ENV F1_SCRAPE_FALLBACK_DIR=/app/cache

COPY --chown=appuser:appuser . .

EXPOSE 8000

USER appuser

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
