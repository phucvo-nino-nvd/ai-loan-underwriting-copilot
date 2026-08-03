FROM python:3.12-slim

WORKDIR /opt/program

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/classifier/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/classifier ./backend/classifier
COPY output/models ./output/models

ENV PYTHONPATH=/opt/program/backend

RUN printf '#!/bin/sh\nexec uvicorn classifier.server:app --host 0.0.0.0 --port 8080\n' > /usr/local/bin/serve \
    && chmod +x /usr/local/bin/serve

EXPOSE 8080
CMD ["serve"]
