CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================================
-- Общие вспомогательные функции
-- =========================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- users
-- =========================================================================
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(254)  NOT NULL,
    password_hash VARCHAR(255)  NOT NULL,
    display_name  VARCHAR(100)  NOT NULL,
    role          VARCHAR(20)   NOT NULL,
    enabled       BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT ck_users_role CHECK (role IN ('USER', 'SUPPORT', 'ADMIN'))
);


CREATE UNIQUE INDEX uq_users_email_lower ON users (LOWER(email));

CREATE INDEX idx_users_updated_at ON users (updated_at);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================================
-- categories
-- =========================================================================
CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(50)   NOT NULL,
    name        VARCHAR(100)  NOT NULL,
    description TEXT,
    active      BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT uq_categories_code UNIQUE (code)
);

CREATE INDEX idx_categories_updated_at ON categories (updated_at);

CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================================
-- tickets
-- =========================================================================
CREATE SEQUENCE ticket_number_seq START WITH 1000;

CREATE TABLE tickets (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    number       VARCHAR(30)   NOT NULL,

    author_id    UUID          NOT NULL REFERENCES users (id),
    assignee_id  UUID          REFERENCES users (id),
    category_id  UUID          NOT NULL REFERENCES categories (id),

    title        VARCHAR(200)  NOT NULL,
    description  TEXT          NOT NULL,

    status       VARCHAR(30)   NOT NULL DEFAULT 'NEW',
    priority     VARCHAR(20)   NOT NULL DEFAULT 'MEDIUM',


    ml_category_id         UUID REFERENCES categories (id),
    ml_category_confidence NUMERIC(5, 4),
    ml_priority             VARCHAR(20),
    ml_priority_confidence  NUMERIC(5, 4),
    ml_model_version        VARCHAR(100),
    ml_prediction_status    VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    resolved_at  TIMESTAMPTZ,
    closed_at    TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,

    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),

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
        ml_prediction_status IN ('PENDING', 'SUCCESS', 'FAILED')
    ),

    CONSTRAINT ck_tickets_ml_category_confidence_range CHECK (
        ml_category_confidence IS NULL OR (ml_category_confidence >= 0 AND ml_category_confidence <= 1)
    ),
    CONSTRAINT ck_tickets_ml_priority_confidence_range CHECK (
        ml_priority_confidence IS NULL OR (ml_priority_confidence >= 0 AND ml_priority_confidence <= 1)
    ),

    CONSTRAINT ck_tickets_ml_success_requires_fields CHECK (
        ml_prediction_status <> 'SUCCESS' OR (
            ml_category_id IS NOT NULL
            AND ml_category_confidence IS NOT NULL
            AND ml_priority IS NOT NULL
            AND ml_priority_confidence IS NOT NULL
            AND ml_model_version IS NOT NULL
        )
    ),

    CONSTRAINT ck_tickets_resolved_after_created CHECK (
        resolved_at IS NULL OR resolved_at >= created_at
    ),
    CONSTRAINT ck_tickets_closed_after_created CHECK (
        closed_at IS NULL OR closed_at >= created_at
    ),
    CONSTRAINT ck_tickets_cancelled_after_created CHECK (
        cancelled_at IS NULL OR cancelled_at >= created_at
    ),
    CONSTRAINT ck_tickets_closed_after_resolved CHECK (
        resolved_at IS NULL OR closed_at IS NULL OR closed_at >= resolved_at
    ),


    CONSTRAINT ck_tickets_resolved_requires_resolved_at CHECK (
        status <> 'RESOLVED' OR resolved_at IS NOT NULL
    ),
    CONSTRAINT ck_tickets_closed_requires_dates CHECK (
        status <> 'CLOSED' OR (resolved_at IS NOT NULL AND closed_at IS NOT NULL)
    ),
    CONSTRAINT ck_tickets_cancelled_requires_cancelled_at CHECK (
        status <> 'CANCELLED' OR cancelled_at IS NOT NULL
    )
);


CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.number IS NULL THEN
        NEW.number := 'TCK-' || LPAD(nextval('ticket_number_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tickets_number
    BEFORE INSERT ON tickets
    FOR EACH ROW EXECUTE FUNCTION generate_ticket_number();

CREATE TRIGGER trg_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE OR REPLACE FUNCTION check_ticket_assignee_role()
RETURNS TRIGGER AS $$
DECLARE
    assignee_role VARCHAR(20);
BEGIN
    IF NEW.assignee_id IS NOT NULL THEN
        SELECT role INTO assignee_role FROM users WHERE id = NEW.assignee_id;
        IF assignee_role IS NULL OR assignee_role NOT IN ('SUPPORT', 'ADMIN') THEN
            RAISE EXCEPTION 'assignee_id (%) must reference a user with role SUPPORT or ADMIN, got %',
                NEW.assignee_id, assignee_role;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tickets_assignee_role
    BEFORE INSERT OR UPDATE OF assignee_id ON tickets
    FOR EACH ROW EXECUTE FUNCTION check_ticket_assignee_role();


CREATE INDEX idx_tickets_author_created
    ON tickets (author_id, created_at);
CREATE INDEX idx_tickets_assignee_status_updated
    ON tickets (assignee_id, status, updated_at);
CREATE INDEX idx_tickets_status_priority_created
    ON tickets (status, priority, created_at);
CREATE INDEX idx_tickets_category_status
    ON tickets (category_id, status);
CREATE INDEX idx_tickets_updated_at
    ON tickets (updated_at);

-- =========================================================================
-- comments
-- =========================================================================
CREATE TABLE comments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id  UUID        NOT NULL REFERENCES tickets (id),
    author_id  UUID        NOT NULL REFERENCES users (id),
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
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id  UUID        NOT NULL REFERENCES tickets (id),
    -- changed_by может быть NULL для системных событий (например, ML fallback).
    changed_by UUID        REFERENCES users (id),
    event_type VARCHAR(50) NOT NULL,
    field_name VARCHAR(50),
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
