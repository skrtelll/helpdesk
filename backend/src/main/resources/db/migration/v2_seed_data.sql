INSERT INTO cateroties(code,name,description,active) VALUES
    ('ACCOUNT', 'Account', 'Учетная запись: пароль, блокировка, вход, профиль/аутентификация',TRUE),
    ('NETWORK', 'Network', 'Сеть, VPN,DNS,интернет и сетовое соединение',TRUE),
    ('ACCESS', 'Access', 'Права и доступ к ресурсу: папке, БД,корпоративное системе и т,п.',TRUE),
    ('SOFTWARE', 'Software', 'Приложение, ошибки ПО, установка и обновление', TRUE),
    ('HARDWARE', 'Hardware', 'Физические оборудование', TRUE),
    ('OTHER', 'Other', 'Обращение не относящиеся уверенно к остальным классам; используется как fallback при создании заявки и при отказе ML', TRUE);
