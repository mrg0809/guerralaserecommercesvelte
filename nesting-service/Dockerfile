FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    inkscape \
    fontconfig \
    fonts-liberation \
    python3-numpy \
    python3-lxml \
    python3-pip \
    && python3.13 -m pip install --break-system-packages tinycss2 cssselect \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py trace.py test_nesting.py test_vector_export.py ./
COPY vector/ ./vector/
COPY assets/fonts/ ./assets/fonts/
RUN fc-cache -f -v ./assets/fonts/ 2>/dev/null || true

EXPOSE 8081

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8081"]
