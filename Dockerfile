FROM python:3.12-slim
RUN useradd -m -u 1000 app
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend backend
COPY web web
ENV PORT=8080 CHRONO_CACHE=/tmp/chronosphere-cache
USER app
EXPOSE 8080
CMD ["sh", "-c", "python -m uvicorn server:app --app-dir backend --host 0.0.0.0 --port ${PORT}"]
