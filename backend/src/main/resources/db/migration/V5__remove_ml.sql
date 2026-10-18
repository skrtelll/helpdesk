-- HelpDesk — V5: удаление ML-классификации из проекта.
-- Решение команды: ML не входит в MVP. V1–V4 не изменяются (иначе Flyway
-- упадёт на проверке checksum), поэтому всё удаление делается этой миграцией.
-- IF EXISTS: миграция одинаково работает и на базе, где V1 создавалась с ML-полями,
-- и на базе, где их не было.

-- 1. ML-колонки. Вместе с ними PostgreSQL удаляет связанные CHECK, FK и индексы.
ALTER TABLE tickets DROP COLUMN IF EXISTS ml_category_id;
ALTER TABLE tickets DROP COLUMN IF EXISTS ml_category_confidence;
ALTER TABLE tickets DROP COLUMN IF EXISTS ml_priority;
ALTER TABLE tickets DROP COLUMN IF EXISTS ml_priority_confidence;
ALTER TABLE tickets DROP COLUMN IF EXISTS ml_model_version;
ALTER TABLE tickets DROP COLUMN IF EXISTS ml_prediction_status;

-- 2. Журнал аудита: события ML больше не существуют.
--    Удаляем только строки этих двух типов (в dev-базах их не должно быть).
--    Остальные записи журнала не трогаем.
DELETE FROM ticket_history WHERE event_type IN ('ML_PREDICTION_APPLIED', 'ML_PREDICTION_FAILED');

ALTER TABLE ticket_history DROP CONSTRAINT IF EXISTS ticket_history_event_type_check;
ALTER TABLE ticket_history ADD CONSTRAINT ck_ticket_history_event_type CHECK (event_type IN (
    'TICKET_CREATED',
    'STATUS_CHANGED',
    'PRIORITY_CHANGED',
    'CATEGORY_CHANGED',
    'ASSIGNEE_CHANGED',
    'COMMENT_ADDED',
    'TICKET_RESOLVED',
    'TICKET_REOPENED',
    'TICKET_CLOSED',
    'TICKET_CANCELLED'
));
