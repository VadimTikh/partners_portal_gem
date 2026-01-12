# N8N Workflow Corrections: partner_id -> customer_number

В предыдущей инструкции была допущена ошибка. В базе данных используется `customer_number`, а не `partner_id`. Ниже приведены все изменения, которые необходимо внести в уже реализованный workflow.

---

## 1. Изменения в схеме базы данных PostgreSQL

### Было:
```sql
CREATE TABLE course_requests (
    id SERIAL PRIMARY KEY,
    partner_id INTEGER NOT NULL,
    ...
);

CREATE INDEX idx_course_requests_partner_id ON course_requests(partner_id);
```

### Должно быть:
```sql
CREATE TABLE course_requests (
    id SERIAL PRIMARY KEY,
    customer_number INTEGER NOT NULL,
    partner_name VARCHAR(255) NOT NULL,
    partner_email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    base_price DECIMAL(10,2) NOT NULL,
    partner_description TEXT NOT NULL,
    requested_dates JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    rejection_recommendations TEXT,
    manager_notes TEXT,
    created_course_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_course_requests_customer_number ON course_requests(customer_number);
CREATE INDEX idx_course_requests_status ON course_requests(status);
```

### Если таблица уже создана, выполните:
```sql
-- Переименование колонки
ALTER TABLE course_requests RENAME COLUMN partner_id TO customer_number;

-- Пересоздание индекса
DROP INDEX IF EXISTS idx_course_requests_partner_id;
CREATE INDEX idx_course_requests_customer_number ON course_requests(customer_number);
```

---

## 2. Изменения в Code Nodes

### 2.1 Prepare Request Data (Create Course Request)

**Было:**
```javascript
return {
  partner_id: partnerInfo.partnerId,
  ...
};
```

**Должно быть:**
```javascript
return {
  customer_number: partnerInfo.customer_number,
  partner_name: partnerInfo.name,
  partner_email: partnerInfo.email,
  name: body.name,
  location: body.location,
  base_price: body.basePrice,
  partner_description: body.partnerDescription,
  requested_dates: JSON.stringify(body.requestedDates || []),
  status: 'pending'
};
```

### 2.2 Format Response Nodes (Map to CamelCase)

**Было:**
```javascript
return {
  partnerId: row.partner_id,
  ...
};
```

**Должно быть:**
```javascript
return {
  id: row.id,
  partnerId: row.customer_number, // Возвращаем как partnerId для фронтенда
  partnerName: row.partner_name,
  partnerEmail: row.partner_email,
  name: row.name,
  location: row.location,
  basePrice: parseFloat(row.base_price),
  partnerDescription: row.partner_description,
  requestedDates: row.requested_dates,
  status: row.status,
  rejectionReason: row.rejection_reason,
  rejectionRecommendations: row.rejection_recommendations,
  managerNotes: row.manager_notes,
  createdCourseId: row.created_course_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at
};
```

### 2.3 Merge Partner Data (Get Partners)

**Было:**
```javascript
pendingMap[item.json.partner_id] = parseInt(item.json.pending_count);
```

**Должно быть:**
```javascript
pendingMap[item.json.customer_number] = parseInt(item.json.pending_count);
```

---

## 3. Изменения в Postgres Queries

### 3.1 Insert Course Request

**Было:**
```sql
INSERT INTO course_requests (
    partner_id, partner_name, partner_email,
    ...
) VALUES (
    {{ $json.partner_id }},
    ...
```

**Должно быть:**
```sql
INSERT INTO course_requests (
    customer_number, partner_name, partner_email,
    name, location, base_price, partner_description,
    requested_dates, status
) VALUES (
    {{ $json.customer_number }},
    '{{ $json.partner_name }}',
    '{{ $json.partner_email }}',
    '{{ $json.name }}',
    '{{ $json.location }}',
    {{ $json.base_price }},
    '{{ $json.partner_description }}',
    '{{ $json.requested_dates }}'::jsonb,
    '{{ $json.status }}'
) RETURNING *;
```

### 3.2 Get Partner Requests

**Было:**
```sql
SELECT * FROM course_requests
WHERE partner_id = {{ $json.partnerInfo.partnerId }}
ORDER BY created_at DESC;
```

**Должно быть:**
```sql
SELECT * FROM course_requests
WHERE customer_number = {{ $json.partnerInfo.customer_number }}
ORDER BY created_at DESC;
```

### 3.3 Get Pending Requests Count

**Было:**
```sql
SELECT partner_id, COUNT(*) as pending_count
FROM course_requests
WHERE status = 'pending'
GROUP BY partner_id;
```

**Должно быть:**
```sql
SELECT customer_number, COUNT(*) as pending_count
FROM course_requests
WHERE status = 'pending'
GROUP BY customer_number;
```

---

## 4. Изменения в MySQL Queries (Magento)

### 4.1 Get Operators from Magento

Здесь изменений нет, так как `operator_id` в Magento соответствует `customer_number` в PostgreSQL. Но нужно убедиться, что JOIN работает корректно:

```sql
SELECT
    o.operator_id as id,
    o.partnername as name,
    o.contact_email as email,
    o.name as companyName,
    (
        SELECT COUNT(*) FROM catalog_product_entity cpe
        INNER JOIN catalog_product_entity_varchar cpev
        ON cpe.entity_id = cpev.entity_id AND cpev.attribute_id = 700
        WHERE cpev.value = CAST(o.operator_id AS CHAR)
        AND cpe.type_id = 'configurable'
    ) as coursesCount
FROM miomente_pdf_operator o
WHERE o.status = 1
ORDER BY o.name;
```

---

## 5. Изменения в Login Response

### 5.1 Format Login Response

**Было:**
```javascript
return {
  email: user.email,
  name: user.name,
  token: token,
  role: user.is_manager ? 'manager' : 'partner',
  partnerId: user.partner_id,
  partnerName: user.name
};
```

**Должно быть:**
```javascript
return {
  email: user.email,
  name: user.name,
  token: token,
  role: user.is_manager ? 'manager' : 'partner',
  partnerId: user.customer_number, // Для совместимости с фронтендом
  customer_number: user.customer_number, // Для использования в запросах
  partnerName: user.name
};
```

---

## 6. Изменения в JWT Token / partnerInfo

Убедитесь, что при декодировании JWT токена в n8n вы получаете `customer_number`:

**Структура partnerInfo должна быть:**
```javascript
{
  customer_number: 123,     // Основной идентификатор
  name: "Partner Name",
  email: "partner@example.com",
  role: "partner" | "manager"
}
```

---

## 7. Проверка таблицы users в PostgreSQL

Убедитесь, что в таблице `users` есть колонка `customer_number`:

```sql
-- Проверить структуру
\d users

-- Если колонка называется partner_id, переименовать:
ALTER TABLE users RENAME COLUMN partner_id TO customer_number;
```

---

## Резюме изменений

| Компонент | Было | Стало |
|-----------|------|-------|
| PostgreSQL колонка | `partner_id` | `customer_number` |
| PostgreSQL индекс | `idx_course_requests_partner_id` | `idx_course_requests_customer_number` |
| Code Node переменные | `partner_id`, `partnerId` | `customer_number` |
| SQL запросы WHERE | `partner_id = ...` | `customer_number = ...` |
| Login response | `partnerId: user.partner_id` | `partnerId: user.customer_number` |
| partnerInfo в JWT | `partnerInfo.partnerId` | `partnerInfo.customer_number` |

---

## Примечание

Фронтенд продолжает использовать `partnerId` в TypeScript интерфейсах для удобства. В n8n при формировании ответов мы конвертируем `customer_number` в `partnerId`:

```javascript
// В Code Node при формировании ответа
return {
  partnerId: row.customer_number, // БД -> фронтенд
  ...
};
```

При получении данных от фронтенда, `partnerId` приходит и должен использоваться как `customer_number` в запросах к БД.
