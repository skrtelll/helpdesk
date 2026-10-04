package com.helpdesk.backend.ticket

/** Статус ML-прогноза. Совпадает с CHECK ck_tickets_ml_prediction_status. */
enum class MlPredictionStatus {
    PENDING,
    SUCCESS,
    FAILED,
}
