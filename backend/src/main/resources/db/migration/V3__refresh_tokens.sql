-- HelpDesk — хранение refresh token (PostgreSQL 13+)
-- Хранится только SHA-256 хеш токена (hex, 64 символа), сам токен не сохраняется.
-- Миграция добавляет новую таблицу; V1/V2 не изменяются.

CREATE TABLE refresh_tokens (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash  VARCHAR(64)  NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ  NOT NULL,
    revoked_at  TIMESTAMPTZ  NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CHECK (expires_at > created_at),
    CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);-- HelpDesk — хранение refresh token (PostgreSQL 13+)
-- Хранится только SHA-256 хеш токена (hex, 64 символа), сам токен не сохраняется.
-- Миграция добавляет новую таблицу; V1/V2 не изменяются.

CREATE TABLE refresh_tokens (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash  VARCHAR(64)  NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ  NOT NULL,
    revoked_at  TIMESTAMPTZ  NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CHECK (expires_at > created_at),
    CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
