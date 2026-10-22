# syntax=docker/dockerfile:1
# ============================================================
# Stage 1: builder
#   - install build tools + compile Python deps into /opt/venv
# ============================================================
FROM python:3.11-slim AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        gcc \
        g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./

RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# ============================================================
# Stage 2: runner
#   - lean image, copy /opt/venv + app code, non-root user
# ============================================================
FROM python:3.11-slim AS runner

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# Copy the built virtual env from the builder image.
COPY --from=builder /opt/venv /opt/venv

# Create the non-root user up front so we can chown writable dirs.
RUN groupadd -r appuser \
    && useradd -r -g appuser -d /app -s /usr/sbin/nologin appuser

# Observability writes to /app/logs and FastF1 cache to /app/cache —
# both must exist before the app starts as appuser.
RUN mkdir -p /app/cache /app/logs \
    && chown -R appuser:appuser /app/cache /app/logs \
    && chmod -R 775 /app/cache

ENV F1_SCRAPE_FALLBACK_DIR=/app/cache

COPY --chown=appuser:appuser . .

EXPOSE 8000

USER appuser

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
