# Servicio de visión de Encontrados, pensado para un Space de Hugging Face
# (tipo Docker, CPU básica gratuita). Expone el puerto 7860 como exige HF.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/data/hf \
    TRANSFORMERS_OFFLINE=0

# HF Spaces corre como usuario 1000; los modelos se cachean en /data.
RUN useradd -m -u 1000 app && mkdir -p /data/hf && chown -R app:app /data
WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
RUN chown -R app:app /srv
USER app

# Descargar los modelos en el build para que el arranque en frío sea más corto.
RUN python -c "from app import vision; vision.cargar_modelos()"

EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
