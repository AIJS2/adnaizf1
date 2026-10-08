FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (gcc for compiling some python packages if needed)
RUN apt-get update && apt-get install -y gcc curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install redis

COPY . .

# Create cache directory for FastF1
RUN mkdir -p cache

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
