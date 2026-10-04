-- HelpDesk MVP — начальная схема (PostgreSQL 13+, gen_random_uuid() встроен)

CREATE TABLE users (
    id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(254)  NOT NULL,
    password_hash VARCHAR(255)  NOT NULL,
    display_name  VARCHAR(100)  NOT NULL,
    role          VARCHAR(20)   NOT NULL CHECK (role IN ('USER', 'SUPPORT', 'ADMIN')),
    enabled       BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- email уникален без учёта регистра
CREATE UNIQUE INDEX uq_users_email_lower ON users (LOWER(email));

-- индекс для инкрементальной выгрузки в аналитику (Airflow)
CREATE INDEX idx_users_updated_at ON users (updated_at);

CREATE TABLE categories (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(50)   NOT NULL UNIQUE,
    name        VARCHAR(100)  NOT NULL,
    description TEXT,
    active      BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_updated_at ON categories (updated_at);

CREATE SEQUENCE ticket_number_seq START WITH 1000;

CREATE TABLE tickets (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    number       VARCHAR(30)   NOT NULL DEFAULT ('HD-' || nextval('ticket_number_seq')) UNIQUE,
    author_id    UUID          NOT NULL REFERENCES users (id),
    assignee_id  UUID          REFERENCES users (id),
    category_id  UUID          NOT NULL REFERENCES categories (id),
    title        VARCHAR(200)  NOT NULL,
    description  TEXT          NOT NULL,
    status       VARCHAR(30)   NOT NULL DEFAULT 'NEW'
                 CHECK (status IN ('NEW', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED', 'CANCELLED')),
    priority     VARCHAR(20)   NOT NULL DEFAULT 'MEDIUM'
                 CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),

    -- предсказание ML хранится отдельно от итоговых category/priority
    ml_category_id         UUID REFERENCES categories (id),
    ml_category_confidence NUMERIC(5, 4) CHECK (ml_category_confidence IS NULL OR ml_category_confidence BETWEEN 0 AND 1),
    ml_priority            VARCHAR(20) CHECK (ml_priority IS NULL OR ml_priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    ml_priority_confidence NUMERIC(5, 4) CHECK (ml_priority_confidence IS NULL OR ml_priority_confidence BETWEEN 0 AND 1),
    ml_model_version       VARCHAR(100),
    ml_prediction_status   VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                           CHECK (ml_prediction_status IN ('PENDING', 'SUCCESS', 'FAILED')),

    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    resolved_at  TIMESTAMPTZ,
    closed_at    TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,

    -- оптимистичная блокировка
    version      BIGINT        NOT NULL DEFAULT 0,

    -- метки времени не раньше создания
    CHECK (resolved_at  IS NULL OR resolved_at  >= created_at),
    CHECK (closed_at    IS NULL OR closed_at    >= created_at),
    CHECK (cancelled_at IS NULL OR cancelled_at >= created_at),
    CHECK (resolved_at IS NULL OR closed_at IS NULL OR closed_at >= resolved_at),

    -- статус должен соответствовать заполненным меткам
    CHECK (status <> 'RESOLVED'  OR resolved_at IS NOT NULL),
    CHECK (status <> 'CLOSED'    OR (resolved_at IS NOT NULL AND closed_at IS NOT NULL)),
    CHECK (status <> 'CANCELLED' OR cancelled_at IS NOT NULL),

    -- при SUCCESS все ML-поля заполнены
    CHECK (ml_prediction_status <> 'SUCCESS' OR (
              ml_category_id IS NOT NULL
          AND ml_category_confidence IS NOT NULL
          AND ml_priority IS NOT NULL
          AND ml_priority_confidence IS NOT NULL
          AND ml_model_version IS NOT NULL
    ))
);

-- основные сценарии: список своих заявок, очередь поддержки, фильтры
CREATE INDEX idx_tickets_author_created ON tickets (author_id, created_at);
CREATE INDEX idx_tickets_assignee_status ON tickets (assignee_id, status);
CREATE INDEX idx_tickets_status_priority ON tickets (status, priority);
CREATE INDEX idx_tickets_category_status ON tickets (category_id, status);

-- для инкрементальной выгрузки в аналитику (Airflow)
CREATE INDEX idx_tickets_updated_at ON tickets (updated_at);

CREATE TABLE comments (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id  UUID        NOT NULL REFERENCES tickets (id),
    author_id  UUID        NOT NULL REFERENCES users (id),
    text       TEXT        NOT NULL,
    internal   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_ticket_created ON comments (ticket_id, created_at);
CREATE INDEX idx_comments_created_at ON comments (created_at);

CREATE TABLE ticket_history (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id  UUID        NOT NULL REFERENCES tickets (id),
    changed_by UUID        REFERENCES users (id), -- NULL для системных событий
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'TICKET_CREATED',
        'ML_PREDICTION_APPLIED',
        'ML_PREDICTION_FAILED',
        'STATUS_CHANGED',
        'PRIORITY_CHANGED',
        'CATEGORY_CHANGED',
        'ASSIGNEE_CHANGED',
        'COMMENT_ADDED',
        'TICKET_RESOLVED',
        'TICKET_REOPENED',
        'TICKET_CLOSED',
        'TICKET_CANCELLED'
    )),
    field_name VARCHAR(50),
    old_value  TEXT,
    new_value  TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_history_ticket_created ON ticket_history (ticket_id, created_at);
CREATE INDEX idx_ticket_history_created_at ON ticket_history (created_at);
