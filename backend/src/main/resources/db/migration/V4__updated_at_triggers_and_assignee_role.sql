-- HelpDesk — V4: автообновление updated_at и проверка роли исполнителя.
-- Добавляет только новые объекты; V1–V3 не изменяются.

-- ---------------------------------------------------------------------------
-- 1. updated_at должен реально меняться при каждом UPDATE.
--    Без этого инкрементальная выгрузка в аналитику (по updated_at) не увидит
--    изменённые строки. clock_timestamp() — фактическое время изменения, а не
--    время начала транзакции.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Исполнителем заявки может быть только SUPPORT или ADMIN
--    (логическая модель, п.3). Если решите держать это правило только в
--    сервисном слое — удалите этот блок.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3. Опечатка в описании категории OTHER из V2 ("заявокк").
--    V2 не трогаем (иначе сломается checksum Flyway), правим данные здесь.
-- ---------------------------------------------------------------------------
UPDATE categories
SET description = 'Категория по умолчанию для новых и неклассифицированных заявок'
WHERE code = 'OTHER' AND description LIKE '%заявокк';
