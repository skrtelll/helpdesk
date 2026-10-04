-- Шесть предопределённых категорий HelpDesk.
-- 'OTHER' — fallback-категория, используемая при создании заявки до применения
-- ML-рекомендации, а также при отказе ML (FR-TICKET-002, ML-007).
INSERT INTO categories (code, name, description, active) VALUES
    ('ACCOUNT',  'Account',  'Вопросы учётной записи, аутентификации и профиля пользователя', TRUE),
    ('NETWORK',  'Network',  'Проблемы сети и подключения', TRUE),
    ('ACCESS',   'Access',   'Запросы и проблемы доступа к системам и ресурсам', TRUE),
    ('SOFTWARE', 'Software', 'Проблемы с программным обеспечением и настройками приложений', TRUE),
    ('HARDWARE', 'Hardware', 'Неисправности и заявки на оборудование', TRUE),
    ('OTHER',    'Other',    'Категория по умолчанию для новых и неклассифицированных заявок', TRUE)
ON CONFLICT (code) DO NOTHING;
