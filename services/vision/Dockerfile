# Servicio de visión de Encontrados para Google Cloud Run (lo construye
# desplegar.sh con `gcloud run deploy --source`). Cloud Run pasa el puerto en
# PORT (8080); sin PORT escucha en 7860.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/opt/modelos

WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Los modelos se bajan en el build y quedan dentro de la imagen: el arranque en
# frío los lee del disco y no depende de Hugging Face.
RUN python -c "from app import vision; vision.cargar_modelos()"
ENV HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1

RUN useradd -m -u 1000 app && chown -R app:app /srv /opt/modelos
USER app

EXPOSE 8080
CMD ["python", "-m", "app"]
