FROM python:3.10-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Create the FastF1 / scraper cache directory up front. fastf1.Cache.enable_cache
# and the scraper's standings snapshot both write here; without it the first
# write happens inside a request and fails on a read-only or missing path.
RUN mkdir -p /app/cache && chmod 777 /app/cache

ENV F1_SCRAPE_FALLBACK_DIR=/app/cache

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
