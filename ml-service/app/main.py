# Заглушка ML Service для инфраструктуры (compose, CI, healthcheck).
# ML-команда заменяет её реальной моделью; контракт — раздел 8 API-документации.
import os

from fastapi import FastAPI, Header, HTTPException

app = FastAPI(title="helpdesk-ml-service")

INTERNAL_SECRET = os.environ.get("ML_INTERNAL_SECRET", "")


@app.get("/health")
def health() -> dict:
    return {"status": "UP"}


@app.post("/predict")
def predict(x_internal_secret: str | None = Header(default=None)) -> dict:
    if not INTERNAL_SECRET or x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="invalid internal secret")
    # Модели ещё нет: backend на 503 сохраняет заявку с OTHER/MEDIUM и FAILED
    raise HTTPException(status_code=503, detail="model is not loaded")
