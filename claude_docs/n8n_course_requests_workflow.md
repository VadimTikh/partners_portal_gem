# N8N Workflow: Запросы на курсы (Course Requests)

Этот документ содержит инструкции по настройке n8n workflow для функции запросов на курсы в Partners Portal.

## Обзор архитектуры

| Компонент | База данных | N8N Node |
|-----------|-------------|----------|
| Пользователи (users) | PostgreSQL | Postgres node |
| Запросы на курсы (course_requests) | PostgreSQL | Postgres node |
| Курсы Magento (catalog) | MySQL | MySQL node |
| Операторы (operators) | MySQL | MySQL node |

---

## Схема базы данных

### PostgreSQL: Таблица course_requests

Выполните этот SQL в вашей PostgreSQL базе данных:

```sql
CREATE TABLE course_requests (
    id SERIAL PRIMARY KEY,
    partner_id INTEGER NOT NULL,
    partner_name VARCHAR(255) NOT NULL,
    partner_email VARCHAR(255) NOT NULL,

    -- Информация о курсе от партнера
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    base_price DECIMAL(10,2) NOT NULL,
    partner_description TEXT NOT NULL,
    requested_dates JSONB, -- Массив { dateTime, duration, capacity, customPrice? }

    -- Статус и поля менеджера
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    rejection_recommendations TEXT,
    manager_notes TEXT,
    created_course_id INTEGER,

    -- Временные метки
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_course_requests_partner_id ON course_requests(partner_id);
CREATE INDEX idx_course_requests_status ON course_requests(status);
```

### PostgreSQL: Обновление таблицы users

```sql
ALTER TABLE users ADD COLUMN is_manager BOOLEAN DEFAULT FALSE;
```

---

## Настройка Credentials в N8N

### 1. PostgreSQL Credentials
- **Name:** `PostgreSQL Partners Portal`
- **Host:** ваш_хост
- **Database:** partners_portal
- **User:** ваш_пользователь
- **Password:** ваш_пароль

### 2. MySQL Credentials (Magento)
- **Name:** `MySQL Magento`
- **Host:** ваш_magento_хост
- **Database:** magento
- **User:** ваш_пользователь
- **Password:** ваш_пароль

---

## Ноды для копирования

### Webhook Router (Switch Node)

Добавьте новые cases в ваш существующий Switch node:

```json
{
  "parameters": {
    "rules": {
      "rules": [
        {
          "outputKey": "create-course-request",
          "conditions": {
            "options": { "version": 2 },
            "combinator": "and",
            "conditions": [
              {
                "leftValue": "={{ $json.query.action }}",
                "rightValue": "create-course-request",
                "operator": { "type": "string", "operation": "equals" }
              }
            ]
          }
        },
        {
          "outputKey": "get-course-requests",
          "conditions": {
            "options": { "version": 2 },
            "combinator": "and",
            "conditions": [
              {
                "leftValue": "={{ $json.query.action }}",
                "rightValue": "get-course-requests",
                "operator": { "type": "string", "operation": "equals" }
              }
            ]
          }
        },
        {
          "outputKey": "get-course-request",
          "conditions": {
            "options": { "version": 2 },
            "combinator": "and",
            "conditions": [
              {
                "leftValue": "={{ $json.query.action }}",
                "rightValue": "get-course-request",
                "operator": { "type": "string", "operation": "equals" }
              }
            ]
          }
        },
        {
          "outputKey": "update-course-request-status",
          "conditions": {
            "options": { "version": 2 },
            "combinator": "and",
            "conditions": [
              {
                "leftValue": "={{ $json.query.action }}",
                "rightValue": "update-course-request-status",
                "operator": { "type": "string", "operation": "equals" }
              }
            ]
          }
        },
        {
          "outputKey": "create-course-from-request",
          "conditions": {
            "options": { "version": 2 },
            "combinator": "and",
            "conditions": [
              {
                "leftValue": "={{ $json.query.action }}",
                "rightValue": "create-course-from-request",
                "operator": { "type": "string", "operation": "equals" }
              }
            ]
          }
        },
        {
          "outputKey": "get-partners",
          "conditions": {
            "options": { "version": 2 },
            "combinator": "and",
            "conditions": [
              {
                "leftValue": "={{ $json.query.action }}",
                "rightValue": "get-partners",
                "operator": { "type": "string", "operation": "equals" }
              }
            ]
          }
        },
        {
          "outputKey": "get-partner-courses",
          "conditions": {
            "options": { "version": 2 },
            "combinator": "and",
            "conditions": [
              {
                "leftValue": "={{ $json.query.action }}",
                "rightValue": "get-partner-courses",
                "operator": { "type": "string", "operation": "equals" }
              }
            ]
          }
        }
      ]
    }
  },
  "name": "Router",
  "type": "n8n-nodes-base.switch",
  "typeVersion": 3
}
```

---

## 1. Create Course Request (Партнер создает запрос)

**Action:** `create-course-request`

### Шаг 1: Code Node - Подготовка данных

```json
{
  "parameters": {
    "jsCode": "// Получаем данные из входящего запроса\nconst body = $input.first().json.body;\nconst partnerInfo = $input.first().json.partnerInfo; // из JWT декодирования\n\nreturn {\n  partner_id: partnerInfo.partnerId,\n  partner_name: partnerInfo.name,\n  partner_email: partnerInfo.email,\n  name: body.name,\n  location: body.location,\n  base_price: body.basePrice,\n  partner_description: body.partnerDescription,\n  requested_dates: JSON.stringify(body.requestedDates || []),\n  status: 'pending'\n};"
  },
  "name": "Prepare Request Data",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2
}
```

### Шаг 2: Postgres Node - Вставка запроса

```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "INSERT INTO course_requests (\n    partner_id, partner_name, partner_email,\n    name, location, base_price, partner_description, \n    requested_dates, status\n) VALUES (\n    {{ $json.partner_id }},\n    '{{ $json.partner_name }}',\n    '{{ $json.partner_email }}',\n    '{{ $json.name }}',\n    '{{ $json.location }}',\n    {{ $json.base_price }},\n    '{{ $json.partner_description }}',\n    '{{ $json.requested_dates }}'::jsonb,\n    '{{ $json.status }}'\n) RETURNING *;",
    "options": {}
  },
  "name": "Insert Course Request",
  "type": "n8n-nodes-base.postgres",
  "typeVersion": 2.5,
  "credentials": {
    "postgres": {
      "id": "YOUR_POSTGRES_CREDENTIAL_ID",
      "name": "PostgreSQL Partners Portal"
    }
  }
}
```

### Шаг 3: Code Node - Форматирование ответа

```json
{
  "parameters": {
    "jsCode": "const row = $input.first().json;\n\nreturn {\n  id: row.id,\n  partnerId: row.partner_id,\n  partnerName: row.partner_name,\n  partnerEmail: row.partner_email,\n  name: row.name,\n  location: row.location,\n  basePrice: parseFloat(row.base_price),\n  partnerDescription: row.partner_description,\n  requestedDates: row.requested_dates,\n  status: row.status,\n  createdAt: row.created_at,\n  updatedAt: row.updated_at\n};"
  },
  "name": "Format Response",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2
}
```

---

## 2. Get Course Requests (Получение списка запросов)

**Action:** `get-course-requests`

### Для партнера (только свои запросы):

```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT * FROM course_requests \nWHERE partner_id = {{ $json.partnerInfo.partnerId }}\nORDER BY created_at DESC;",
    "options": {}
  },
  "name": "Get Partner Requests",
  "type": "n8n-nodes-base.postgres",
  "typeVersion": 2.5,
  "credentials": {
    "postgres": {
      "id": "YOUR_POSTGRES_CREDENTIAL_ID",
      "name": "PostgreSQL Partners Portal"
    }
  }
}
```

### Для менеджера (все запросы):

```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT * FROM course_requests \nORDER BY \n  CASE status \n    WHEN 'pending' THEN 1 \n    WHEN 'in_moderation' THEN 2 \n    ELSE 3 \n  END,\n  created_at DESC;",
    "options": {}
  },
  "name": "Get All Requests",
  "type": "n8n-nodes-base.postgres",
  "typeVersion": 2.5,
  "credentials": {
    "postgres": {
      "id": "YOUR_POSTGRES_CREDENTIAL_ID",
      "name": "PostgreSQL Partners Portal"
    }
  }
}
```

### Code Node - Преобразование в camelCase:

```json
{
  "parameters": {
    "jsCode": "const items = $input.all();\n\nreturn items.map(item => {\n  const row = item.json;\n  return {\n    id: row.id,\n    partnerId: row.partner_id,\n    partnerName: row.partner_name,\n    partnerEmail: row.partner_email,\n    name: row.name,\n    location: row.location,\n    basePrice: parseFloat(row.base_price),\n    partnerDescription: row.partner_description,\n    requestedDates: row.requested_dates,\n    status: row.status,\n    rejectionReason: row.rejection_reason,\n    rejectionRecommendations: row.rejection_recommendations,\n    managerNotes: row.manager_notes,\n    createdCourseId: row.created_course_id,\n    createdAt: row.created_at,\n    updatedAt: row.updated_at\n  };\n});"
  },
  "name": "Map to CamelCase",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2
}
```

---

## 3. Get Single Course Request

**Action:** `get-course-request`

```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT * FROM course_requests WHERE id = {{ $json.body.request_id }};",
    "options": {}
  },
  "name": "Get Request By ID",
  "type": "n8n-nodes-base.postgres",
  "typeVersion": 2.5,
  "credentials": {
    "postgres": {
      "id": "YOUR_POSTGRES_CREDENTIAL_ID",
      "name": "PostgreSQL Partners Portal"
    }
  }
}
```

---

## 4. Update Course Request Status (Только менеджер)

**Action:** `update-course-request-status`

### Шаг 1: IF Node - Проверка роли менеджера

```json
{
  "parameters": {
    "conditions": {
      "options": { "version": 2 },
      "combinator": "and",
      "conditions": [
        {
          "leftValue": "={{ $json.partnerInfo.role }}",
          "rightValue": "manager",
          "operator": { "type": "string", "operation": "equals" }
        }
      ]
    }
  },
  "name": "Is Manager?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2
}
```

### Шаг 2: Postgres Node - Обновление статуса

```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "UPDATE course_requests\nSET\n    status = '{{ $json.body.status }}',\n    rejection_reason = COALESCE(NULLIF('{{ $json.body.rejectionReason }}', ''), rejection_reason),\n    rejection_recommendations = COALESCE(NULLIF('{{ $json.body.rejectionRecommendations }}', ''), rejection_recommendations),\n    manager_notes = COALESCE(NULLIF('{{ $json.body.managerNotes }}', ''), manager_notes),\n    updated_at = NOW()\nWHERE id = {{ $json.body.request_id }}\nRETURNING *;",
    "options": {}
  },
  "name": "Update Request Status",
  "type": "n8n-nodes-base.postgres",
  "typeVersion": 2.5,
  "credentials": {
    "postgres": {
      "id": "YOUR_POSTGRES_CREDENTIAL_ID",
      "name": "PostgreSQL Partners Portal"
    }
  }
}
```

### Шаг 3: IF Node - Отправить email при отклонении

```json
{
  "parameters": {
    "conditions": {
      "options": { "version": 2 },
      "combinator": "and",
      "conditions": [
        {
          "leftValue": "={{ $json.status }}",
          "rightValue": "rejected",
          "operator": { "type": "string", "operation": "equals" }
        }
      ]
    }
  },
  "name": "Is Rejected?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2
}
```

### Шаг 4: Send Email Node - Уведомление об отклонении

```json
{
  "parameters": {
    "sendTo": "={{ $json.partner_email }}",
    "subject": "Kursanfrage abgelehnt: {{ $json.name }}",
    "emailType": "html",
    "message": "<h1>Ihre Kursanfrage wurde abgelehnt</h1>\n\n<p>Sehr geehrte/r {{ $json.partner_name }},</p>\n\n<p>leider müssen wir Ihnen mitteilen, dass Ihre Kursanfrage für\n\"<strong>{{ $json.name }}</strong>\" nicht genehmigt werden konnte.</p>\n\n<h3>Ablehnungsgrund:</h3>\n<p>{{ $json.rejection_reason }}</p>\n\n{{ $json.rejection_recommendations ? '<h3>Unsere Empfehlungen:</h3><p>' + $json.rejection_recommendations + '</p>' : '' }}\n\n<p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>\n\n<p>Mit freundlichen Grüßen,<br>\nIhr Miomente Team</p>",
    "options": {}
  },
  "name": "Send Rejection Email",
  "type": "n8n-nodes-base.emailSend",
  "typeVersion": 2.1
}
```

---

## 5. Get Partners (Только менеджер)

**Action:** `get-partners`

### MySQL Node - Получение операторов из Magento

```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT\n    o.operator_id as id,\n    o.partnername as name,\n    o.contact_email as email,\n    o.name as companyName,\n    (\n        SELECT COUNT(*) FROM catalog_product_entity cpe\n        INNER JOIN catalog_product_entity_varchar cpev\n        ON cpe.entity_id = cpev.entity_id AND cpev.attribute_id = 700\n        WHERE cpev.value = CAST(o.operator_id AS CHAR) \n        AND cpe.type_id = 'configurable'\n    ) as coursesCount\nFROM miomente_pdf_operator o\nWHERE o.status = 1\nORDER BY o.name;"
  },
  "name": "Get Operators from Magento",
  "type": "n8n-nodes-base.mySql",
  "typeVersion": 2.4,
  "credentials": {
    "mySql": {
      "id": "YOUR_MYSQL_CREDENTIAL_ID",
      "name": "MySQL Magento"
    }
  }
}
```

### Postgres Node - Добавление счетчика запросов

```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT partner_id, COUNT(*) as pending_count \nFROM course_requests \nWHERE status = 'pending'\nGROUP BY partner_id;",
    "options": {}
  },
  "name": "Get Pending Requests Count",
  "type": "n8n-nodes-base.postgres",
  "typeVersion": 2.5,
  "credentials": {
    "postgres": {
      "id": "YOUR_POSTGRES_CREDENTIAL_ID",
      "name": "PostgreSQL Partners Portal"
    }
  }
}
```

### Code Node - Объединение данных

```json
{
  "parameters": {
    "jsCode": "const operators = $('Get Operators from Magento').all();\nconst pendingCounts = $('Get Pending Requests Count').all();\n\n// Создаем map для быстрого поиска\nconst pendingMap = {};\npendingCounts.forEach(item => {\n  pendingMap[item.json.partner_id] = parseInt(item.json.pending_count);\n});\n\n// Добавляем счетчик к каждому оператору\nreturn operators.map(op => ({\n  id: op.json.id,\n  name: op.json.name,\n  email: op.json.email,\n  companyName: op.json.companyName,\n  coursesCount: parseInt(op.json.coursesCount) || 0,\n  pendingRequestsCount: pendingMap[op.json.id] || 0\n}));"
  },
  "name": "Merge Partner Data",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2
}
```

---

## 6. Create Course from Request (Только менеджер)

**Action:** `create-course-from-request`

Это самый сложный endpoint. Он выполняет:
1. Получение запроса из PostgreSQL
2. Создание configurable product в Magento (MySQL)
3. Создание дат (simple products) если есть
4. Обновление статуса запроса
5. Отправка email партнеру

### Шаг 1: Postgres Node - Получение запроса

```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT * FROM course_requests WHERE id = {{ $json.body.requestId }};",
    "options": {}
  },
  "name": "Get Request",
  "type": "n8n-nodes-base.postgres",
  "typeVersion": 2.5,
  "credentials": {
    "postgres": {
      "id": "YOUR_POSTGRES_CREDENTIAL_ID",
      "name": "PostgreSQL Partners Portal"
    }
  }
}
```

### Шаг 2: MySQL Node - Получение operator_id

```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT operator_id FROM miomente_pdf_operator \nWHERE operator_id = {{ $('Get Request').first().json.partner_id }};"
  },
  "name": "Get Operator",
  "type": "n8n-nodes-base.mySql",
  "typeVersion": 2.4,
  "credentials": {
    "mySql": {
      "id": "YOUR_MYSQL_CREDENTIAL_ID",
      "name": "MySQL Magento"
    }
  }
}
```

### Шаг 3: Code Node - Подготовка данных для Magento

```json
{
  "parameters": {
    "jsCode": "const request = $('Get Request').first().json;\nconst body = $('Webhook').first().json.body;\nconst operatorId = $('Get Operator').first().json.operator_id;\n\n// Генерируем уникальный SKU\nconst timestamp = Date.now();\nconst sku = `PP-${operatorId}-${timestamp}`;\nconst urlKey = request.name\n  .toLowerCase()\n  .replace(/[äöüß]/g, match => ({ä:'ae',ö:'oe',ü:'ue',ß:'ss'}[match]))\n  .replace(/[^a-z0-9]+/g, '-')\n  .replace(/-+/g, '-')\n  .replace(/^-|-$/g, '') + '-' + timestamp;\n\nreturn {\n  sku,\n  urlKey,\n  operatorId,\n  name: request.name,\n  subtitle: body.subtitle || '',\n  description: body.description,\n  shortDescription: body.shortDescription,\n  price: parseFloat(request.base_price),\n  location: request.location,\n  beginTime: body.beginTime,\n  endTime: body.endTime,\n  seats: body.seats,\n  participants: body.participants,\n  categoryIds: body.categoryIds,\n  keyword: body.keyword || '',\n  metaTitle: body.metaTitle || request.name,\n  metaDescription: body.metaDescription || '',\n  image: body.image || 'no_selection',\n  requestId: request.id,\n  partnerEmail: request.partner_email,\n  partnerName: request.partner_name,\n  requestedDates: request.requested_dates\n};"
  },
  "name": "Prepare Magento Data",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2
}
```

### Шаг 4: MySQL Node - Создание configurable product

```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "-- Вставка в catalog_product_entity\nINSERT INTO catalog_product_entity \n(attribute_set_id, type_id, sku, has_options, required_options, created_at, updated_at)\nVALUES (4, 'configurable', '{{ $json.sku }}', 1, 0, NOW(), NOW());\n\nSET @product_id = LAST_INSERT_ID();\n\n-- Название (attribute_id = 73)\nINSERT INTO catalog_product_entity_varchar \n(attribute_id, store_id, entity_id, value)\nVALUES (73, 0, @product_id, '{{ $json.name }}');\n\n-- URL Key (attribute_id = 97)\nINSERT INTO catalog_product_entity_varchar \n(attribute_id, store_id, entity_id, value)\nVALUES (97, 0, @product_id, '{{ $json.urlKey }}');\n\n-- Описание (attribute_id = 75)\nINSERT INTO catalog_product_entity_text \n(attribute_id, store_id, entity_id, value)\nVALUES (75, 0, @product_id, '{{ $json.description }}');\n\n-- Краткое описание (attribute_id = 76)\nINSERT INTO catalog_product_entity_text \n(attribute_id, store_id, entity_id, value)\nVALUES (76, 0, @product_id, '{{ $json.shortDescription }}');\n\n-- Цена (attribute_id = 77)\nINSERT INTO catalog_product_entity_decimal \n(attribute_id, store_id, entity_id, value)\nVALUES (77, 0, @product_id, {{ $json.price }});\n\n-- Статус enabled (attribute_id = 97)\nINSERT INTO catalog_product_entity_int \n(attribute_id, store_id, entity_id, value)\nVALUES (97, 0, @product_id, 1);\n\n-- Видимость (attribute_id = 99)\nINSERT INTO catalog_product_entity_int \n(attribute_id, store_id, entity_id, value)\nVALUES (99, 0, @product_id, 4);\n\n-- Operator ID (attribute_id = 700)\nINSERT INTO catalog_product_entity_varchar \n(attribute_id, store_id, entity_id, value)\nVALUES (700, 0, @product_id, '{{ $json.operatorId }}');\n\n-- Location (attribute_id = 701)\nINSERT INTO catalog_product_entity_varchar \n(attribute_id, store_id, entity_id, value)\nVALUES (701, 0, @product_id, '{{ $json.location }}');\n\n-- Begin Time (attribute_id = 702)\nINSERT INTO catalog_product_entity_varchar \n(attribute_id, store_id, entity_id, value)\nVALUES (702, 0, @product_id, '{{ $json.beginTime }}');\n\n-- End Time (attribute_id = 703)\nINSERT INTO catalog_product_entity_varchar \n(attribute_id, store_id, entity_id, value)\nVALUES (703, 0, @product_id, '{{ $json.endTime }}');\n\n-- Seats (attribute_id = 704)\nINSERT INTO catalog_product_entity_varchar \n(attribute_id, store_id, entity_id, value)\nVALUES (704, 0, @product_id, '{{ $json.seats }}');\n\n-- Participants (attribute_id = 705)\nINSERT INTO catalog_product_entity_varchar \n(attribute_id, store_id, entity_id, value)\nVALUES (705, 0, @product_id, '{{ $json.participants }}');\n\n-- Возвращаем ID созданного продукта\nSELECT @product_id as entity_id, '{{ $json.sku }}' as sku;"
  },
  "name": "Create Magento Product",
  "type": "n8n-nodes-base.mySql",
  "typeVersion": 2.4,
  "credentials": {
    "mySql": {
      "id": "YOUR_MYSQL_CREDENTIAL_ID",
      "name": "MySQL Magento"
    }
  }
}
```

### Шаг 5: Postgres Node - Обновление статуса запроса

```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "UPDATE course_requests\nSET \n    status = 'approved',\n    created_course_id = {{ $('Create Magento Product').first().json.entity_id }},\n    updated_at = NOW()\nWHERE id = {{ $('Prepare Magento Data').first().json.requestId }}\nRETURNING *;",
    "options": {}
  },
  "name": "Update Request to Approved",
  "type": "n8n-nodes-base.postgres",
  "typeVersion": 2.5,
  "credentials": {
    "postgres": {
      "id": "YOUR_POSTGRES_CREDENTIAL_ID",
      "name": "PostgreSQL Partners Portal"
    }
  }
}
```

### Шаг 6: Send Email Node - Уведомление об одобрении

```json
{
  "parameters": {
    "sendTo": "={{ $('Prepare Magento Data').first().json.partnerEmail }}",
    "subject": "Kursanfrage genehmigt: {{ $('Prepare Magento Data').first().json.name }}",
    "emailType": "html",
    "message": "<h1>Ihre Kursanfrage wurde genehmigt!</h1>\n\n<p>Sehr geehrte/r {{ $('Prepare Magento Data').first().json.partnerName }},</p>\n\n<p>wir freuen uns, Ihnen mitteilen zu können, dass Ihre Kursanfrage für\n\"<strong>{{ $('Prepare Magento Data').first().json.name }}</strong>\" genehmigt wurde!</p>\n\n<p>Ihr Kurs ist jetzt im System angelegt und kann im Partner Portal\neingesehen und verwaltet werden.</p>\n\n<p><a href=\"https://partners.miomente.de/dashboard/editor/{{ $('Create Magento Product').first().json.entity_id }}\">Kurs im Portal ansehen</a></p>\n\n<p>Mit freundlichen Grüßen,<br>\nIhr Miomente Team</p>",
    "options": {}
  },
  "name": "Send Approval Email",
  "type": "n8n-nodes-base.emailSend",
  "typeVersion": 2.1
}
```

### Шаг 7: Code Node - Форматирование ответа

```json
{
  "parameters": {
    "jsCode": "const product = $('Create Magento Product').first().json;\nconst data = $('Prepare Magento Data').first().json;\n\nreturn {\n  id: product.entity_id,\n  title: data.name,\n  sku: product.sku,\n  status: 'active',\n  description: data.description,\n  basePrice: data.price,\n  location: data.location,\n  image: data.image\n};"
  },
  "name": "Format Course Response",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2
}
```

---

## 7. Login - Обновление для ролей

### Postgres Node - Проверка пользователя с ролью

```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT \n    u.id,\n    u.email,\n    u.name,\n    u.password_hash,\n    u.partner_id,\n    u.is_manager,\n    o.partnername as partner_name\nFROM users u\nLEFT JOIN miomente_pdf_operator o ON u.partner_id = o.operator_id\nWHERE u.email = '{{ $json.body.email }}';",
    "options": {}
  },
  "name": "Get User with Role",
  "type": "n8n-nodes-base.postgres",
  "typeVersion": 2.5,
  "credentials": {
    "postgres": {
      "id": "YOUR_POSTGRES_CREDENTIAL_ID",
      "name": "PostgreSQL Partners Portal"
    }
  }
}
```

### Code Node - Формирование ответа с ролью

```json
{
  "parameters": {
    "jsCode": "const user = $input.first().json;\nconst token = 'generated_jwt_token'; // Ваша логика генерации токена\n\nreturn {\n  email: user.email,\n  name: user.name,\n  token: token,\n  role: user.is_manager ? 'manager' : 'partner',\n  partnerId: user.partner_id,\n  partnerName: user.partner_name\n};"
  },
  "name": "Format Login Response",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2
}
```

---

## 8. Get Partner Courses (Только менеджер)

**Action:** `get-partner-courses`

### MySQL Node - Курсы конкретного партнера

```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT \n    cpe.entity_id as id,\n    cpe.sku,\n    cpev_name.value as title,\n    cpev_location.value as location,\n    cped_price.value as basePrice,\n    cpei_status.value as status\nFROM catalog_product_entity cpe\nINNER JOIN catalog_product_entity_varchar cpev_op \n    ON cpe.entity_id = cpev_op.entity_id AND cpev_op.attribute_id = 700\nLEFT JOIN catalog_product_entity_varchar cpev_name \n    ON cpe.entity_id = cpev_name.entity_id AND cpev_name.attribute_id = 73 AND cpev_name.store_id = 0\nLEFT JOIN catalog_product_entity_varchar cpev_location \n    ON cpe.entity_id = cpev_location.entity_id AND cpev_location.attribute_id = 701 AND cpev_location.store_id = 0\nLEFT JOIN catalog_product_entity_decimal cped_price \n    ON cpe.entity_id = cped_price.entity_id AND cped_price.attribute_id = 77 AND cped_price.store_id = 0\nLEFT JOIN catalog_product_entity_int cpei_status \n    ON cpe.entity_id = cpei_status.entity_id AND cpei_status.attribute_id = 97 AND cpei_status.store_id = 0\nWHERE cpe.type_id = 'configurable'\n    AND cpev_op.value = '{{ $json.body.partner_id }}'\nORDER BY cpe.created_at DESC;"
  },
  "name": "Get Partner Courses",
  "type": "n8n-nodes-base.mySql",
  "typeVersion": 2.4,
  "credentials": {
    "mySql": {
      "id": "YOUR_MYSQL_CREDENTIAL_ID",
      "name": "MySQL Magento"
    }
  }
}
```

---

## Безопасность

### Проверка роли менеджера

Используйте этот IF Node перед всеми manager-only операциями:

```json
{
  "parameters": {
    "conditions": {
      "options": { "version": 2 },
      "combinator": "and",
      "conditions": [
        {
          "leftValue": "={{ $json.partnerInfo.role }}",
          "rightValue": "manager",
          "operator": { "type": "string", "operation": "equals" }
        }
      ]
    }
  },
  "name": "Check Manager Role",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2
}
```

### Проверка доступа партнера к своим данным

```json
{
  "parameters": {
    "conditions": {
      "options": { "version": 2 },
      "combinator": "or",
      "conditions": [
        {
          "leftValue": "={{ $json.partnerInfo.role }}",
          "rightValue": "manager",
          "operator": { "type": "string", "operation": "equals" }
        },
        {
          "leftValue": "={{ $json.partnerInfo.partnerId }}",
          "rightValue": "={{ $json.requestPartnerId }}",
          "operator": { "type": "number", "operation": "equals" }
        }
      ]
    }
  },
  "name": "Check Access",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2
}
```

---

## Тестовые аккаунты

### Партнер
- **Email:** `demo@miomente.com`
- **Password:** `demo`
- **Role:** `partner`

### Менеджер
- **Email:** `manager@miomente.com`
- **Password:** `manager`
- **Role:** `manager`

---

## Примечания

1. **Замените credential IDs** - В каждом node замените `YOUR_POSTGRES_CREDENTIAL_ID` и `YOUR_MYSQL_CREDENTIAL_ID` на реальные ID ваших credentials.

2. **Attribute IDs** - ID атрибутов в MySQL (73, 75, 76, 77, 97, 99, 700-705) могут отличаться в вашей установке Magento. Проверьте таблицу `eav_attribute`.

3. **Email Node** - Для отправки email необходимо настроить SMTP credentials.

4. **JWT Token** - Логика декодирования JWT токена должна быть реализована отдельно в Code Node перед основными операциями.
