FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if any, none needed for simple http.server
# Copy the codebase
COPY . .

# Install google-genai SDK
RUN pip install --no-cache-dir google-genai

# Modify server.py dynamically inside the container so it binds to 0.0.0.0 and Cloud Run's dynamic $PORT
RUN sed -i 's/"127.0.0.1"/"0.0.0.0"/g' server.py && \
    sed -i 's/PORT = 8000/PORT = int(os.environ.get("PORT", 8080))/g' server.py

# Expose port (Cloud Run defaults to 8080, but can be overridden)
EXPOSE 8080

CMD ["python", "server.py"]
