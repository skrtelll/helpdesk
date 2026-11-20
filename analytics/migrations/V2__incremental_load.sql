DO $$
BEGIN
    IF current_database() <> 'helpdesk_analytics' THEN
        RAISE EXCEPTION 'Apply this migration in helpdesk_analytics';
    END IF;
END;
$$;

CREATE TABLE analytics.etl_watermark (
    pipeline TEXT PRIMARY KEY,
    loaded_through TIMESTAMPTZ NOT NULL
);

CREATE TABLE analytics.fact_ticket_comments (
    comment_id UUID PRIMARY KEY,
    ticket_id UUID NOT NULL REFERENCES analytics.fact_tickets(ticket_id),
    author_id UUID NOT NULL REFERENCES analytics.dim_user(user_id),
    internal BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE analytics.fact_ticket_events (
    event_id UUID PRIMARY KEY,
    ticket_id UUID NOT NULL REFERENCES analytics.fact_tickets(ticket_id),
    changed_by UUID REFERENCES analytics.dim_user(user_id),
    event_type VARCHAR(50) NOT NULL,
    field_name VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL
);
