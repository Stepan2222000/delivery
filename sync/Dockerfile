FROM python:3.13-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

COPY sync/requirements.txt ./
RUN pip install -r requirements.txt

COPY sync/main.py sync/eta_parser.py ./

CMD ["python", "main.py"]
