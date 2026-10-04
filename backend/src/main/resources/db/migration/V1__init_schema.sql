-- =========================================================================
-- users
-- =========================================================================
CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    email         VARCHAR(255)  NOT NULL,
    password_hash VARCHAR(255)  NOT NULL,
    display_name  VARCHAR(150)  NOT NULL,
    role          VARCHAR(20)   NOT NULL,
    enabled       BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_role CHECK (role IN ('USER', 'SUPPORT', 'ADMIN'))
);

-- =========================================================================
-- categories
-- =========================================================================
CREATE TABLE categories (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(50)   NOT NULL,
    name        VARCHAR(150)  NOT NULL,
    description TEXT,
    active      BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT uq_categories_code UNIQUE (code)
);

-- =========================================================================
-- tickets
-- =========================================================================
-- Человекочитаемый номер заявки (независимо от суррогатного id).
CREATE SEQUENCE ticket_number_seq START WITH 1000;

CREATE TABLE tickets (
    id           BIGSERIAL PRIMARY KEY,
    number       BIGINT        NOT NULL DEFAULT nextval('ticket_number_seq'),

    author_id    BIGINT        NOT NULL REFERENCES users (id),
    assignee_id  BIGINT        REFERENCES users (id),
    category_id  BIGINT        NOT NULL REFERENCES categories (id),

    title        VARCHAR(200)  NOT NULL,
    description  TEXT          NOT NULL,

    status       VARCHAR(30)   NOT NULL DEFAULT 'NEW',
    priority     VARCHAR(20)   NOT NULL DEFAULT 'MEDIUM',

    -- ML-поля хранятся отдельно от итоговых category/priority (BR-005, ML-006/007).
    ml_category_code   VARCHAR(50),
    ml_priority        VARCHAR(20),
    ml_confidence      NUMERIC(5, 4),
    ml_model_version   VARCHAR(50),
    ml_prediction_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    resolved_at  TIMESTAMPTZ,
    closed_at    TIMESTAMPTZ,

    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),

    -- Optimistic locking (п.14 / BR-013).
    version      BIGINT        NOT NULL DEFAULT 0,

    CONSTRAINT uq_tickets_number UNIQUE (number),

    CONSTRAINT ck_tickets_status CHECK (
        status IN ('NEW', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED', 'CANCELLED')
    ),
    CONSTRAINT ck_tickets_priority CHECK (
        priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
    ),
    CONSTRAINT ck_tickets_ml_priority CHECK (
        ml_priority IS NULL OR ml_priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
    ),
    CONSTRAINT ck_tickets_ml_prediction_status CHECK (
        ml_prediction_status IN ('PENDING', 'APPLIED', 'FAILED')
    ),
    CONSTRAINT ck_tickets_ml_confidence CHECK (
        ml_confidence IS NULL OR (ml_confidence >= 0 AND ml_confidence <= 1)
    ),
    -- resolved_at/closed_at должны идти в правильном порядке (DE-004).
    CONSTRAINT ck_tickets_resolved_before_closed CHECK (
        resolved_at IS NULL OR closed_at IS NULL OR resolved_at <= closed_at
    )
);

-- Рекомендуемые индексы (п.14 ТЗ).
CREATE INDEX idx_tickets_author_created
    ON tickets (author_id, created_at);
CREATE INDEX idx_tickets_assignee_status_updated
    ON tickets (assignee_id, status, updated_at);
CREATE INDEX idx_tickets_status_priority_created
    ON tickets (status, priority, created_at);
CREATE INDEX idx_tickets_category_status
    ON tickets (category_id, status);

-- =========================================================================
-- comments
-- =========================================================================
CREATE TABLE comments (
    id         BIGSERIAL PRIMARY KEY,
    ticket_id  BIGINT      NOT NULL REFERENCES tickets (id),
    author_id  BIGINT      NOT NULL REFERENCES users (id),
    text       TEXT        NOT NULL,
    internal   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_ticket_created
    ON comments (ticket_id, created_at);

-- =========================================================================
-- ticket_history
-- =========================================================================
CREATE TABLE ticket_history (
    id         BIGSERIAL PRIMARY KEY,
    ticket_id  BIGINT      NOT NULL REFERENCES tickets (id),
    -- changed_by может быть NULL для системных событий (например, ML fallback).
    changed_by BIGINT      REFERENCES users (id),
    event_type VARCHAR(40) NOT NULL,
    field_name VARCHAR(60),
    old_value  TEXT,
    new_value  TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_ticket_history_event_type CHECK (
        event_type IN (
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
        )
    )
);

CREATE INDEX idx_ticket_history_ticket_created
    ON ticket_history (ticket_id, created_at);
