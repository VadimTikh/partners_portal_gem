-- Migration script: Copy data from dev to prod
-- Tables: miomente_partner_portal_users, miomente_course_requests, miomente_partner_portal_sessions
-- Generated: 2026-01-19
-- WARNING: This will DELETE all existing data in prod tables!

BEGIN;

-- ============================================
-- 1. USERS (22 records)
-- ============================================
TRUNCATE TABLE miomente_partner_portal_sessions CASCADE;
TRUNCATE TABLE miomente_partner_portal_users CASCADE;

INSERT INTO miomente_partner_portal_users (id, email, name, password, customer_number, is_manager, created_at, reset_token, reset_token_expires) VALUES
('3d20c683-c81b-4fd8-bb91-b341ca4d1dbb', 'info@foodatlas.de', 'Alla Maer', 'cd9bc0d7a90200be473050fb6467db1a74c4f1724fc8ef764d4470402680782b', '126734', false, '2026-01-06T10:37:12.365Z', NULL, NULL),
('29b1e388-c69d-4794-8a65-6e06a45ee3a4', 'mapo@2cyou.de', '2CYOU GmbH | Mark Podschadly', '?wOJ6PXDWe07', '101462', false, '2026-01-08T22:01:22.431Z', NULL, NULL),
('d10dab50-42a0-4287-ac3f-21b7bb591b4d', 'anfrage@buchenau-comedy.de', 'Peter Buchenau', '637pow7(>B8Y', '554432', false, '2026-01-08T22:03:19.407Z', NULL, NULL),
('06818aec-064e-45e6-9ac3-a5e27de113d5', 'admin@boni-brands.com', 'Manager', 'ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f', NULL, true, '2026-01-13T10:39:35.875Z', 'ae7e8d3d407aeb9bb5237020b26a536412d60a6d497e35356d3b8b6f4218ab90', '2026-01-17T21:58:51.262Z'),
('5f20d0f6-71bc-475f-92d6-5f73d80a0139', 'info@juliankutos.com', 'Julian Kutos Kochschule', '881744c6352265bb56ae96a569e9e0934f61f77b57373cedd2e4e72574b64652', '367223', false, '2026-01-13T11:46:50.800Z', NULL, NULL),
('e6e3716f-1b7c-4541-8801-a6905396d5ce', 'ute@taste-the-city.eu', 'Die Genussprojekte | Ehrenfeld ', 'ad2cd6b7e099e01348d2c731b9249cfb9767e4088351d1747559afb28fa7cf8e', '105505', false, '2026-01-13T11:49:51.375Z', NULL, NULL),
('be91b3ee-282d-4aff-8bb0-975e5435f7bf', 'pr@heidi-rauch.de', 'Heidi Rauch', '1KO8&(pH=A51', '124438', false, '2026-01-13T11:51:29.745Z', NULL, NULL),
('ee412170-15cf-4f20-9ea2-d46adb1e08dd', 'info@raise-your-spirits.at', 'Erhard Ruthner', 'tyNuUt$}.492', '115639', false, '2026-01-13T11:54:05.058Z', NULL, NULL),
('68240702-d580-428b-8499-84aa09e838d4', 'info@wein-augsburg.de', 'Uli Scheffler Weinhandel', 'ZP/33T8H(+z8', '105339', false, '2026-01-13T11:54:56.948Z', NULL, NULL),
('df53aa32-dfc0-4efb-b718-4f577f357f83', 'kontakt@dittmers-kochlounge.de', 'Volker Dittmer', 'b681c6c3aa4aefff3b434a41308bfe8420b14bf4b42c2c9a121c2b4e91e2d0e2', '112238', false, '2026-01-13T11:55:40.378Z', NULL, NULL),
('abc6cf80-5d37-4531-9a3b-55c451cef2b5', 'christian@menzinger-weinladen.de', 'Menzinger Weinladen GmbH', '>9U7=U<6|hzT', '528007', false, '2026-01-13T11:56:23.178Z', NULL, NULL),
('21214f19-1830-4145-9af6-8b571f387996', 'info@gourmets-for-Nature.de', 'Gourmets for Nature GmbH Annegret Frund', 'M51}_ai;H''9]', '318816', false, '2026-01-13T11:57:19.054Z', NULL, NULL),
('1dc9c784-b8f4-4116-9b11-daa02a5ea7f1', 'info@vino-gusto.de', 'Ute Albers | Vienna House easy by Wyndham Dortmund', 'p91Q::K6RIl3', '625563', false, '2026-01-13T11:58:37.044Z', NULL, NULL),
('7d39ddeb-10ca-4693-ae9f-38d32877d0a3', 'email@mehr-vom-essen.de', 'Elisabeth Edele |anderswo im Westend', 'BmI10Z*68#iw', '103079', false, '2026-01-13T11:59:10.677Z', NULL, NULL),
('1fc4bad6-8611-46a8-935f-e3ebdb447c5d', 'tino.polaski@kochagentur.info', 'Kochagentur I Thomas Frevert', '>N5<tk)J;08L', '114817', false, '2026-01-13T11:59:49.063Z', NULL, NULL),
('fcffaccf-0d78-4c1f-8dff-559ca8255f1f', 'info@bambi-barakademie.de', 'Bambi Bar Akademie | Franz Klingenthal & Madleine Kahr', '9CoP:+1u]1[C', '105084', false, '2026-01-13T12:00:38.186Z', NULL, NULL),
('ae78ee7f-45ab-4233-82f7-80a9c6427bdb', 'info@studio32.berlin', 'Fred Terre Leif Ludtke & Mahmoud El-Sayed GbR (Studio 32)', 'f2ec55f125ce47e5b786e1bb4b61c660b15291b9c34961ce3f7e3563a6bf7036', '543063', false, '2026-01-13T12:03:27.569Z', NULL, NULL),
('d1210c50-7ce7-43fa-b025-aeb0a9bcb6b3', 'daniel.piterna@yahoo.com', 'BrewCraft | Daniel Piterna | Uberquell', '%48d5o?tuJZq', '129519', false, '2026-01-13T12:03:56.442Z', NULL, NULL),
('ee51d945-61ac-45bf-8e61-c2703a100d9d', 'info@sardovino.de', 'SardoVINO GmbH', 'dsU4;657:4>]', '103981', false, '2026-01-13T12:04:47.997Z', NULL, NULL),
('4efcf9ca-16b0-4bd1-92f9-5d5c1e4283c8', 'info@backzeit-backstudio.de', 'Backzeit ', 'pGC6gs99)T''@', '141235', false, '2026-01-13T12:08:27.902Z', NULL, NULL),
('3fb04f69-7086-4103-ae2d-b636937460c5', 'info@barista-academy.eu', 'Barista Academy - Maxim Kaffee GmbH', '7d585d5f36da5f79433dd744b280301c1ecd2f36da0bd605c76e5a8e21a03f22', '560424', false, '2026-01-13T12:09:02.570Z', NULL, NULL),
('83e39e12-2de8-4739-974d-f264f75aa6f0', 'testa4toptech@gmail.com', 'Test A4', 'ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f', '367223', false, '2026-01-13T12:12:35.711Z', 'ba593843f51aa1ae3621f894a9734100e4f379bb4c047eec39e73deafe6e3cdf', '2026-01-16T10:51:53.268Z');

-- ============================================
-- 2. COURSE REQUESTS (6 records)
-- ============================================
TRUNCATE TABLE miomente_course_requests RESTART IDENTITY CASCADE;

INSERT INTO miomente_course_requests (id, customer_number, partner_name, partner_email, course_name, location, base_price, partner_description, requested_dates, status, rejection_reason, rejection_recommendations, manager_notes, created_course_id, created_at, updated_at) VALUES
(21, '543063', 'Fred Terre Leif Ludtke & Mahmoud El-Sayed GbR (Studio 32)', 'info@studio32.berlin', 'Glutenfreier Soulfood Kochkurs', 'Berlin', 119.00,
'studio32 Berlin trifft Marion von WANDA

Tauche ein in die herzhaften, ehrlichen Geschmacker der alpenlandisch-italienischen Kuche - vollkommen glutenfrei und voller Seele. Gemeinsam mit Wanda erlebst du im Studio32 Berlin einen Kochkurs, der traditionelle Rezepte, moderne pflanzenbasierte Kuche und personliche Geschichten miteinander verbindet. Unter professioneller Anleitung lernst du, wie du wohltuende Gerichte kreierst, die ohne Kompromisse auskommen und ganz einfach nach "gutem Essen" schmecken.

Die Kunst des glutenfreien Soulfoods
In diesem Kurs dreht sich alles um aromenreiche, glutenfreie Kuche, die aus authentischen Zutaten und kreativen Techniken entsteht. Marion von Wanda - ursprunglich aus Sudtirol und ausgebildete Sternekochin - zeigt dir, wie alpine Klassiker und italienische Feinheit in glutenfreier Form wunderbar harmonieren. Du lernst, wie du Teige, Gnocchi und Suspeisen so zubereitest, dass sie keine Ersatzprodukte brauchen, sondern von selbst uberzeugen.',
'[{"capacity":10,"dateTime":"2026-02-08T11:00:00","duration":240},{"capacity":10,"dateTime":"2026-02-28T17:00:00","duration":237},{"capacity":10,"dateTime":"2026-03-12T18:00:00","duration":240}]'::json,
'pending', NULL, NULL, NULL, NULL, '2026-01-19T11:18:41.788Z', '2026-01-19T11:18:41.788Z'),

(22, '543063', 'Fred Terre Leif Ludtke & Mahmoud El-Sayed GbR (Studio 32)', 'info@studio32.berlin', 'Wine Club', 'Berlin', 59.00,
'Wine Club - Deine Wein Verkostung in Berlin
Entdecke die faszinierende Welt des Weins in unserem Wine Club x studio32 und lerne, wie verschiedene Rebsorten, Regionen und Anbauweisen den Geschmack pragen.',
'[{"capacity":10,"dateTime":"2026-02-27T19:30:00","duration":180},{"capacity":10,"dateTime":"2026-04-24T19:30:00","duration":180},{"capacity":10,"dateTime":"2026-05-29T19:30:00","duration":180},{"capacity":10,"dateTime":"2026-06-26T19:30:00","duration":180},{"capacity":10,"dateTime":"2026-03-27T19:30:00","duration":180}]'::json,
'pending', NULL, NULL, NULL, NULL, '2026-01-19T11:45:38.819Z', '2026-01-19T11:45:38.819Z'),

(23, '543063', 'Fred Terre Leif Ludtke & Mahmoud El-Sayed GbR (Studio 32)', 'info@studio32.berlin', 'Espresso Martini Workshop', 'Berlin', 59.00,
'Entdecke die Kunst eines der elegantesten Drinks der Welt: den Espresso Martini.
In unserem Workshop lernst Du, wie Du diesen ikonischen Cocktail selbst perfekt zubereitest: cremig, stark und perfekt balanciert.',
'[{"capacity":10,"dateTime":"2026-03-13T20:00:00","duration":120},{"capacity":10,"dateTime":"2026-05-02T20:00:00","duration":118}]'::json,
'pending', NULL, NULL, NULL, NULL, '2026-01-19T11:47:11.281Z', '2026-01-19T11:47:11.281Z'),

(24, '543063', 'Fred Terre Leif Ludtke & Mahmoud El-Sayed GbR (Studio 32)', 'info@studio32.berlin', 'Garden Cocktails - Vom Balkon an die Bar', 'Berlin', 59.00,
'Die Kunst der Krauter Cocktails
Frisch, aromatisch und voller Geschmack: Das Garden Special zeigt Dir, wie Du mit den Krautern von Deinem Balkon oder aus Deinem Garten ausergewohnliche Drinks mixt.',
'[{"capacity":10,"dateTime":"2026-04-04T20:00:00","duration":120},{"capacity":10,"dateTime":"2026-06-19T20:00:00","duration":120}]'::json,
'pending', NULL, NULL, NULL, NULL, '2026-01-19T11:48:27.643Z', '2026-01-19T11:48:27.643Z'),

(25, '543063', 'Fred Terre Leif Ludtke & Mahmoud El-Sayed GbR (Studio 32)', 'info@studio32.berlin', 'Croissants & Pain au Chocolat', 'Berlin', 119.00,
'Franzosisches Fruhstucksgeback - Croissants & Pain au Chocolat Backkurs

Der Duft frisch gebackener Croissants liegt in der Luft, goldbraune Schichten knuspern sanft und der erste Biss in ein warmes Pain au Chocolat weckt echtes franzosisches Fruhstucksgefuhl.',
'[{"capacity":10,"dateTime":"2026-02-08T11:00:00","duration":240},{"capacity":10,"dateTime":"2026-03-21T11:00:00","duration":240},{"capacity":10,"dateTime":"2026-04-04T11:00:00","duration":240},{"capacity":10,"dateTime":"2026-05-17T11:00:00","duration":240},{"capacity":10,"dateTime":"2026-01-24T11:00:00","duration":240}]'::json,
'pending', NULL, NULL, NULL, NULL, '2026-01-19T11:50:59.334Z', '2026-01-19T11:50:59.334Z'),

(26, '543063', 'Fred Terre Leif Ludtke & Mahmoud El-Sayed GbR (Studio 32)', 'info@studio32.berlin', 'Veganer "Kase" Workshop', 'Berlin', 119.00,
'Vom Cashewkern zum Keese

Tauche ein in die faszinierende Welt der veganen Kaseherstellung und entdecke, wie aus Cashews durch Fermentation aromatische, lebendige Kasealternativen entstehen.',
'[{"capacity":6,"dateTime":"2026-03-15T11:00:00","duration":180},{"capacity":6,"dateTime":"2026-04-09T18:00:00","duration":180},{"capacity":6,"dateTime":"2026-05-09T11:00:00","duration":180}]'::json,
'pending', NULL, NULL, NULL, NULL, '2026-01-19T14:30:33.224Z', '2026-01-19T14:30:33.224Z');

-- Reset sequence for course_requests
SELECT setval(pg_get_serial_sequence('miomente_course_requests', 'id'), 26);

-- ============================================
-- 3. SESSIONS (50 records)
-- ============================================
-- Sessions already truncated with CASCADE above

INSERT INTO miomente_partner_portal_sessions (user_id, token, created_at, expires_at) VALUES
('3d20c683-c81b-4fd8-bb91-b341ca4d1dbb', 'info-1768546688079-8q66aj2wseu', '2026-01-16T06:58:08.090Z', '2026-01-30T06:58:08.090Z'),
('3d20c683-c81b-4fd8-bb91-b341ca4d1dbb', 'info-1768546716854-cmnqk41bl8s', '2026-01-16T06:58:36.860Z', '2026-01-30T06:58:36.860Z'),
('29b1e388-c69d-4794-8a65-6e06a45ee3a4', 'mapo-1768546786904-xx9ffk5kfgg', '2026-01-16T06:59:46.910Z', '2026-01-30T06:59:46.910Z'),
('3d20c683-c81b-4fd8-bb91-b341ca4d1dbb', 'info-1768546955371-ss49quv3rwa', '2026-01-16T07:02:35.411Z', '2026-01-30T07:02:35.411Z'),
('4efcf9ca-16b0-4bd1-92f9-5d5c1e4283c8', 'info-1768546975652-4yqic18ilgb', '2026-01-16T07:02:55.659Z', '2026-01-30T07:02:55.659Z'),
('3d20c683-c81b-4fd8-bb91-b341ca4d1dbb', 'info-1768546990328-h726tb5eh8', '2026-01-16T07:03:10.334Z', '2026-01-30T07:03:10.334Z'),
('06818aec-064e-45e6-9ac3-a5e27de113d5', 'admin-1768547009427-xsxxhxfb0bp', '2026-01-16T07:03:29.433Z', '2026-01-30T07:03:29.433Z'),
('3d20c683-c81b-4fd8-bb91-b341ca4d1dbb', 'info-1768547219212-ozxcyk2apla', '2026-01-16T07:06:59.216Z', '2026-01-30T07:06:59.216Z'),
('3d20c683-c81b-4fd8-bb91-b341ca4d1dbb', 'info-1768547245350-s4ocfbi77w', '2026-01-16T07:07:25.356Z', '2026-01-30T07:07:25.356Z'),
('3d20c683-c81b-4fd8-bb91-b341ca4d1dbb', 'info-1768547260907-q8sk6rpwkob', '2026-01-16T07:07:40.913Z', '2026-01-30T07:07:40.913Z'),
('83e39e12-2de8-4739-974d-f264f75aa6f0', 'testa4toptech-1768547687952-obulozkeogr', '2026-01-16T07:14:47.960Z', '2026-01-30T07:14:47.960Z'),
('3d20c683-c81b-4fd8-bb91-b341ca4d1dbb', 'info-1768547834017-9amsx9mdnmk', '2026-01-16T07:17:14.022Z', '2026-01-30T07:17:14.022Z'),
('1dc9c784-b8f4-4116-9b11-daa02a5ea7f1', 'info-1768550740909-swzhcrkoefc', '2026-01-16T08:05:40.914Z', '2026-01-30T08:05:40.914Z'),
('1dc9c784-b8f4-4116-9b11-daa02a5ea7f1', 'info-1768550832253-x5d50pk0438', '2026-01-16T08:07:12.257Z', '2026-01-30T08:07:12.257Z'),
('3d20c683-c81b-4fd8-bb91-b341ca4d1dbb', 'info-1768552463975-he9zgyumcta', '2026-01-16T08:34:23.978Z', '2026-01-30T08:34:23.978Z'),
('06818aec-064e-45e6-9ac3-a5e27de113d5', 'admin-1768552494519-391ar9dtd62', '2026-01-16T08:34:54.521Z', '2026-01-30T08:34:54.521Z'),
('06818aec-064e-45e6-9ac3-a5e27de113d5', 'admin-1768552555666-yjdmcbh13hs', '2026-01-16T08:35:55.669Z', '2026-01-30T08:35:55.669Z'),
('06818aec-064e-45e6-9ac3-a5e27de113d5', 'admin-1768552592856-p7gnavmt5oa', '2026-01-16T08:36:32.858Z', '2026-01-30T08:36:32.858Z'),
('ee51d945-61ac-45bf-8e61-c2703a100d9d', 'info-1768555774107-mfrp0xdwma', '2026-01-16T09:29:34.109Z', '2026-01-30T09:29:34.109Z'),
('5f20d0f6-71bc-475f-92d6-5f73d80a0139', 'info-1768556487900-0nas3qjezxwq', '2026-01-16T09:41:27.903Z', '2026-01-30T09:41:27.903Z'),
('5f20d0f6-71bc-475f-92d6-5f73d80a0139', 'info-1768556568199-wgvb7nn6eu', '2026-01-16T09:42:48.206Z', '2026-01-30T09:42:48.206Z'),
('3d20c683-c81b-4fd8-bb91-b341ca4d1dbb', 'info-1768556896544-f7bafq289vm', '2026-01-16T09:48:16.548Z', '2026-01-30T09:48:16.548Z'),
('83e39e12-2de8-4739-974d-f264f75aa6f0', 'testa4toptech-1768557136481-rs8jfxm1uc', '2026-01-16T09:52:16.487Z', '2026-01-30T09:52:16.487Z'),
('83e39e12-2de8-4739-974d-f264f75aa6f0', 'testa4toptech-1768557353201-b3xuoo1r6yb', '2026-01-16T09:55:53.209Z', '2026-01-30T09:55:53.209Z'),
('83e39e12-2de8-4739-974d-f264f75aa6f0', 'testa4toptech-1768557366669-4e7g7hfswn6', '2026-01-16T09:56:06.675Z', '2026-01-30T09:56:06.675Z'),
('83e39e12-2de8-4739-974d-f264f75aa6f0', 'testa4toptech-1768557375532-0vxmfyx74yci', '2026-01-16T09:56:15.538Z', '2026-01-30T09:56:15.538Z'),
('e6e3716f-1b7c-4541-8801-a6905396d5ce', 'ute-1768558804798-ryrsxw9a6j', '2026-01-16T10:20:04.805Z', '2026-01-30T10:20:04.805Z'),
('e6e3716f-1b7c-4541-8801-a6905396d5ce', 'ute-1768559052637-fojx1ip9305', '2026-01-16T10:24:12.643Z', '2026-01-30T10:24:12.643Z'),
('df53aa32-dfc0-4efb-b718-4f577f357f83', 'kontakt-1768559084053-dse1cpoyzo8', '2026-01-16T10:24:44.064Z', '2026-01-30T10:24:44.064Z'),
('ae78ee7f-45ab-4233-82f7-80a9c6427bdb', 'info-1768559339668-i6ex3yx7bgq', '2026-01-16T10:28:59.675Z', '2026-01-30T10:28:59.675Z'),
('3d20c683-c81b-4fd8-bb91-b341ca4d1dbb', 'info-1768565674637-4uk1b1wq44a', '2026-01-16T12:14:34.640Z', '2026-01-30T12:14:34.640Z'),
('3d20c683-c81b-4fd8-bb91-b341ca4d1dbb', 'info-1768568657165-ez8tugs17af', '2026-01-16T13:04:17.170Z', '2026-01-30T13:04:17.170Z'),
('3fb04f69-7086-4103-ae2d-b636937460c5', 'info-1768572770451-bia0psysa2j', '2026-01-16T14:12:50.455Z', '2026-01-30T14:12:50.455Z'),
('06818aec-064e-45e6-9ac3-a5e27de113d5', 'admin-1768574834931-y9dna48twyb', '2026-01-16T14:47:14.934Z', '2026-01-30T14:47:14.934Z'),
('3d20c683-c81b-4fd8-bb91-b341ca4d1dbb', 'info-1768576158648-xzsdwf6dwx', '2026-01-16T15:09:18.653Z', '2026-01-30T15:09:18.653Z'),
('ae78ee7f-45ab-4233-82f7-80a9c6427bdb', 'info-1768590023601-xf22kci90z', '2026-01-16T19:00:23.606Z', '2026-01-30T19:00:23.606Z'),
('ae78ee7f-45ab-4233-82f7-80a9c6427bdb', 'info-1768590077124-i4xwjdfnnme', '2026-01-16T19:01:17.129Z', '2026-01-30T19:01:17.129Z'),
('3d20c683-c81b-4fd8-bb91-b341ca4d1dbb', 'info-1768595412796-i9cm3ipwrf', '2026-01-16T20:30:12.801Z', '2026-01-30T20:30:12.801Z'),
('3d20c683-c81b-4fd8-bb91-b341ca4d1dbb', 'info-1768609486540-wqmgvrlj73', '2026-01-17T00:24:46.544Z', '2026-01-31T00:24:46.544Z'),
('3d20c683-c81b-4fd8-bb91-b341ca4d1dbb', 'info-1768647767003-s60l6gteiro', '2026-01-17T11:02:47.009Z', '2026-01-31T11:02:47.009Z'),
('3d20c683-c81b-4fd8-bb91-b341ca4d1dbb', 'info-1768739648750-c87k9ts5ruk', '2026-01-18T12:34:08.757Z', '2026-02-01T12:34:08.757Z'),
('3d20c683-c81b-4fd8-bb91-b341ca4d1dbb', 'info-1768770801622-lkcrhwn4lpg', '2026-01-18T21:13:21.627Z', '2026-02-01T21:13:21.627Z'),
('3d20c683-c81b-4fd8-bb91-b341ca4d1dbb', 'info-1768815015098-v3rufzlsjlf', '2026-01-19T09:30:15.104Z', '2026-02-02T09:30:15.104Z'),
('e6e3716f-1b7c-4541-8801-a6905396d5ce', 'ute-1768822658759-u8m62z7gu6', '2026-01-19T11:37:38.763Z', '2026-02-02T11:37:38.763Z'),
('3d20c683-c81b-4fd8-bb91-b341ca4d1dbb', 'info-1768825530930-2i3dksg72hn', '2026-01-19T12:25:30.937Z', '2026-02-02T12:25:30.937Z'),
('3d20c683-c81b-4fd8-bb91-b341ca4d1dbb', 'info-1768827070720-h4ms7547jg', '2026-01-19T12:51:10.727Z', '2026-02-02T12:51:10.727Z'),
('83e39e12-2de8-4739-974d-f264f75aa6f0', 'testa4toptech-1768836228647-7plap8m430v', '2026-01-19T15:23:48.650Z', '2026-02-02T15:23:48.650Z'),
('83e39e12-2de8-4739-974d-f264f75aa6f0', 'testa4toptech-1768836383452-bfam7rjxwfv', '2026-01-19T15:26:23.455Z', '2026-02-02T15:26:23.455Z'),
('3d20c683-c81b-4fd8-bb91-b341ca4d1dbb', 'info-1768836712588-m1tln0itlc', '2026-01-19T15:31:52.592Z', '2026-02-02T15:31:52.592Z'),
('68240702-d580-428b-8499-84aa09e838d4', 'info-1768840287255-p8aqtx5u5co', '2026-01-19T16:31:26.388Z', '2026-02-02T16:31:26.388Z');

COMMIT;

-- Verification queries (run after migration)
-- SELECT COUNT(*) FROM miomente_partner_portal_users;  -- Expected: 22
-- SELECT COUNT(*) FROM miomente_course_requests;       -- Expected: 6
-- SELECT COUNT(*) FROM miomente_partner_portal_sessions; -- Expected: 50
