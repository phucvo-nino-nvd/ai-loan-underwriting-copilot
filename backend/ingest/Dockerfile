FROM public.ecr.aws/lambda/python:3.12

WORKDIR /var/task

COPY backend/ingest/requirements.txt ./backend/ingest/requirements.txt
RUN pip install --no-cache-dir -r backend/ingest/requirements.txt

COPY backend/ingest ./backend/ingest

CMD ["backend.ingest.lambda_handler.lambda_handler"]
