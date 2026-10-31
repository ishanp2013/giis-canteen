FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
# Strip Windows line endings in case the script was checked out with CRLF
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh \
    && useradd --create-home --uid 1000 appuser && chown -R appuser /app
USER appuser

EXPOSE 8000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
