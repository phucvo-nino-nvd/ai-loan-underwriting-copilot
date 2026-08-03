FROM public.ecr.aws/awsguru/aws-lambda-adapter:1.0.0 AS lambda-adapter
FROM python:3.12-slim

WORKDIR /app/backend

COPY backend/api/requirements.txt ./api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt

COPY backend/api ./api
COPY backend/database/src ./src

ENV PYTHONPATH="/app/backend:/app/backend/api"
ENV AWS_LWA_PORT=8000
ENV AWS_LWA_INVOKE_MODE=RESPONSE_STREAM

COPY --from=lambda-adapter /lambda-adapter /opt/extensions/lambda-adapter

EXPOSE 8000
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
