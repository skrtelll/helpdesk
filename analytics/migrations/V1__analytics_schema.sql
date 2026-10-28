CREATE SCHEMA analytics;

CREATE TABLE analytics.dim_date (
    date_id       INTEGER PRIMARY KEY, -- YYYYMMDD; 0 is reserved for unknown dates
    full_date     DATE UNIQUE,
    day_of_month  SMALLINT,
    day_of_week   SMALLINT,
    day_name      VARCHAR(9),
    week_of_year  SMALLINT,
    month_number  SMALLINT,
    month_name    VARCHAR(9),
    quarter       SMALLINT,
    year          SMALLINT,
    is_weekend    BOOLEAN,
    is_holiday    BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT ck_dim_date_key CHECK (
        (date_id = 0 AND full_date IS NULL)
        OR (date_id > 0 AND full_date IS NOT NULL
            AND EXTRACT(YEAR FROM full_date) BETWEEN 1 AND 9999
            AND date_id = EXTRACT(YEAR FROM full_date)::INTEGER * 10000
                        + EXTRACT(MONTH FROM full_date)::INTEGER * 100
                        + EXTRACT(DAY FROM full_date)::INTEGER)
    ),
    CHECK (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 31),
    CHECK (day_of_week IS NULL OR day_of_week BETWEEN 1 AND 7),
    CHECK (week_of_year IS NULL OR week_of_year BETWEEN 1 AND 53),
    CHECK (month_number IS NULL OR month_number BETWEEN 1 AND 12),
    CHECK (quarter IS NULL OR quarter BETWEEN 1 AND 4)
);

INSERT INTO analytics.dim_date (date_id, full_date, is_holiday)
VALUES (0, NULL, FALSE);

CREATE TABLE analytics.dim_user (
    user_key          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id           UUID NOT NULL UNIQUE,
    display_name      VARCHAR(100) NOT NULL,
    role              VARCHAR(20) NOT NULL CHECK (role IN ('USER', 'SUPPORT', 'ADMIN')),
    enabled           BOOLEAN NOT NULL,
    source_created_at TIMESTAMPTZ,
    source_updated_at TIMESTAMPTZ,
    loaded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE analytics.dim_support_agent (
    support_agent_key BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id           UUID NOT NULL UNIQUE,
    display_name      VARCHAR(100) NOT NULL,
    role              VARCHAR(20) NOT NULL CHECK (role IN ('SUPPORT', 'ADMIN')),
    enabled           BOOLEAN NOT NULL,
    source_created_at TIMESTAMPTZ,
    source_updated_at TIMESTAMPTZ,
    loaded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE analytics.dim_category (
    category_key     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id      UUID NOT NULL UNIQUE,
    code             VARCHAR(50) NOT NULL,
    name             VARCHAR(100) NOT NULL,
    active           BOOLEAN NOT NULL,
    source_created_at TIMESTAMPTZ,
    source_updated_at TIMESTAMPTZ,
    loaded_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE analytics.fact_tickets (
    ticket_id               UUID PRIMARY KEY,
    author_id               UUID NOT NULL REFERENCES analytics.dim_user(user_id),
    assignee_id             UUID REFERENCES analytics.dim_support_agent(user_id),
    category_id             UUID NOT NULL REFERENCES analytics.dim_category(category_id),
    created_date_id         INTEGER NOT NULL REFERENCES analytics.dim_date(date_id),
    resolved_date_id        INTEGER REFERENCES analytics.dim_date(date_id),
    closed_date_id          INTEGER REFERENCES analytics.dim_date(date_id),
    priority                VARCHAR(20) NOT NULL CHECK (priority IN (
                                'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
                            )),
    status                  VARCHAR(30) NOT NULL CHECK (status IN (
                                   'NEW', 'IN_PROGRESS', 'WAITING_FOR_USER',
                                   'RESOLVED', 'CLOSED', 'CANCELLED'
                               )),
    resolution_time_seconds BIGINT CHECK (resolution_time_seconds IS NULL OR resolution_time_seconds >= 0),
    source_created_at       TIMESTAMPTZ NOT NULL,
    source_updated_at       TIMESTAMPTZ NOT NULL,
    resolved_at             TIMESTAMPTZ,
    closed_at               TIMESTAMPTZ,
    loaded_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (resolved_at IS NULL OR resolved_at >= source_created_at),
    CHECK (closed_at IS NULL OR closed_at >= source_created_at),
    CHECK (resolved_at IS NULL OR closed_at IS NULL OR closed_at >= resolved_at)
);

CREATE INDEX idx_fact_tickets_created_date ON analytics.fact_tickets (created_date_id);
CREATE INDEX idx_fact_tickets_resolved_date ON analytics.fact_tickets (resolved_date_id);
CREATE INDEX idx_fact_tickets_assignee_status ON analytics.fact_tickets (assignee_id, status);
CREATE INDEX idx_fact_tickets_category_status ON analytics.fact_tickets (category_id, status);

CREATE TABLE analytics.support_daily_metrics (
    date                              DATE PRIMARY KEY REFERENCES analytics.dim_date(full_date),
    tickets_created                   BIGINT NOT NULL DEFAULT 0 CHECK (tickets_created >= 0),
    tickets_resolved                  BIGINT NOT NULL DEFAULT 0 CHECK (tickets_resolved >= 0),
    tickets_closed                    BIGINT NOT NULL DEFAULT 0 CHECK (tickets_closed >= 0),
    open_tickets                      BIGINT NOT NULL DEFAULT 0 CHECK (open_tickets >= 0),
    critical_tickets                  BIGINT NOT NULL DEFAULT 0 CHECK (critical_tickets >= 0),
    avg_resolution_time_seconds       NUMERIC(14, 2),
    median_resolution_time_seconds    NUMERIC(14, 2),
    calculated_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (avg_resolution_time_seconds IS NULL OR avg_resolution_time_seconds >= 0),
    CHECK (median_resolution_time_seconds IS NULL OR median_resolution_time_seconds >= 0)
);

CREATE TABLE analytics.support_agent_metrics (
    date                              DATE NOT NULL REFERENCES analytics.dim_date(full_date),
    support_agent_id                  UUID NOT NULL REFERENCES analytics.dim_support_agent(user_id),
    assigned_count                    BIGINT NOT NULL DEFAULT 0 CHECK (assigned_count >= 0),
    resolved_count                    BIGINT NOT NULL DEFAULT 0 CHECK (resolved_count >= 0),
    avg_resolution_time_seconds       NUMERIC(14, 2),
    active_tickets                    BIGINT NOT NULL DEFAULT 0 CHECK (active_tickets >= 0),
    calculated_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (date, support_agent_id),
    CHECK (avg_resolution_time_seconds IS NULL OR avg_resolution_time_seconds >= 0)
);

CREATE INDEX idx_support_agent_metrics_agent_date
    ON analytics.support_agent_metrics (support_agent_id, date);
