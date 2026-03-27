FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py ./
RUN python -m compileall /app
RUN useradd --system --uid 1001 --create-home appuser && chown -R appuser:appuser /app

EXPOSE 8000

USER 1001

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
