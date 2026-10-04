INSERT INTO categories (code, name, description, active) VALUES
    ('ACCOUNT',  'Account',  'Учётная запись: пароль, блокировка, вход, профиль/аутентификация', TRUE),
    ('NETWORK',  'Network',  'Сеть, VPN, DNS, интернет и сетевое соединение', TRUE),
    ('ACCESS',   'Access',   'Права и доступ к ресурсу: папке, БД, корпоративной системе и т.п.', TRUE),
    ('SOFTWARE', 'Software', 'Приложения, ошибки ПО, установка и обновление', TRUE),
    ('HARDWARE', 'Hardware', 'Физическое оборудование', TRUE),
    ('OTHER',    'Other',    'Обращения, не относящиеся уверенно к остальным классам; используется как fallback при создании заявки и при отказе ML', TRUE);
