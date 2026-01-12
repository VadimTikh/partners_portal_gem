# N8N Workflow: Запросы на курсы (Course Requests)

Этот документ содержит ноды для копирования в n8n. Каждый блок JSON можно скопировать и вставить в n8n.

## Обзор архитектуры

| Компонент | База данных | N8N Node |
|-----------|-------------|----------|
| Пользователи (users) | PostgreSQL (Supabase) | Postgres node |
| Запросы на курсы (course_requests) | PostgreSQL (Supabase) | Postgres node |
| Курсы Magento (catalog) | MySQL | MySQL node |
| Операторы (operators) | MySQL | MySQL node |

---

## Схема базы данных

### PostgreSQL: Таблица course_requests

```sql
CREATE TABLE course_requests (
    id SERIAL PRIMARY KEY,
    partner_id INTEGER NOT NULL,
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

CREATE INDEX idx_course_requests_partner_id ON course_requests(partner_id);
CREATE INDEX idx_course_requests_status ON course_requests(status);
```

### PostgreSQL: Обновление таблицы users

```sql
ALTER TABLE users ADD COLUMN is_manager BOOLEAN DEFAULT FALSE;
```

---

## Router Node (Добавить в существующий Switch)

```json
{
  "nodes": [
    {
      "parameters": {
        "rules": {
          "values": [
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 2
                },
                "conditions": [
                  {
                    "id": "cr-001",
                    "leftValue": "={{ $json.query.action }}",
                    "rightValue": "create-course-request",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "create-course-request"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 2
                },
                "conditions": [
                  {
                    "id": "cr-002",
                    "leftValue": "={{ $json.query.action }}",
                    "rightValue": "get-course-requests",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "get-course-requests"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 2
                },
                "conditions": [
                  {
                    "id": "cr-003",
                    "leftValue": "={{ $json.query.action }}",
                    "rightValue": "get-course-request",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "get-course-request"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 2
                },
                "conditions": [
                  {
                    "id": "cr-004",
                    "leftValue": "={{ $json.query.action }}",
                    "rightValue": "update-course-request-status",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "update-course-request-status"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 2
                },
                "conditions": [
                  {
                    "id": "cr-005",
                    "leftValue": "={{ $json.query.action }}",
                    "rightValue": "create-course-from-request",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "create-course-from-request"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 2
                },
                "conditions": [
                  {
                    "id": "cr-006",
                    "leftValue": "={{ $json.query.action }}",
                    "rightValue": "get-partners",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "get-partners"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 2
                },
                "conditions": [
                  {
                    "id": "cr-007",
                    "leftValue": "={{ $json.query.action }}",
                    "rightValue": "get-partner-courses",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "get-partner-courses"
            }
          ]
        },
        "options": {
          "fallbackOutput": "extra"
        }
      },
      "id": "router-course-requests",
      "name": "Course Requests Router",
      "type": "n8n-nodes-base.switch",
      "typeVersion": 3.2,
      "position": [0, 0]
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

---

## 1. Create Course Request

### 1.1 Prepare Request Data (Code Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "jsCode": "const body = $input.first().json.body;\nconst partnerInfo = $input.first().json.partnerInfo;\n\nreturn {\n  partner_id: partnerInfo.partnerId,\n  partner_name: partnerInfo.name,\n  partner_email: partnerInfo.email,\n  name: body.name,\n  location: body.location,\n  base_price: body.basePrice,\n  partner_description: body.partnerDescription,\n  requested_dates: JSON.stringify(body.requestedDates || []),\n  status: 'pending'\n};"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [200, 0],
      "id": "prepare-request-data",
      "name": "Prepare Request Data"
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 1.2 Insert Course Request (Postgres Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "INSERT INTO course_requests (\n    partner_id, partner_name, partner_email,\n    name, location, base_price, partner_description,\n    requested_dates, status\n) VALUES (\n    {{ $json.partner_id }},\n    '{{ $json.partner_name }}',\n    '{{ $json.partner_email }}',\n    '{{ $json.name }}',\n    '{{ $json.location }}',\n    {{ $json.base_price }},\n    '{{ $json.partner_description }}',\n    '{{ $json.requested_dates }}'::jsonb,\n    '{{ $json.status }}'\n) RETURNING *;",
        "options": {}
      },
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.5,
      "position": [400, 0],
      "id": "insert-course-request",
      "name": "Insert Course Request",
      "credentials": {
        "postgres": {
          "id": "YOUR_POSTGRES_CREDENTIAL_ID",
          "name": "Supabase Postgres"
        }
      }
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 1.3 Format Create Response (Code Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "jsCode": "const row = $input.first().json;\n\nreturn {\n  id: row.id,\n  partnerId: row.partner_id,\n  partnerName: row.partner_name,\n  partnerEmail: row.partner_email,\n  name: row.name,\n  location: row.location,\n  basePrice: parseFloat(row.base_price),\n  partnerDescription: row.partner_description,\n  requestedDates: row.requested_dates,\n  status: row.status,\n  createdAt: row.created_at,\n  updatedAt: row.updated_at\n};"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [600, 0],
      "id": "format-create-response",
      "name": "Format Create Response"
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 1.4 Create Request Response (Webhook Response Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ JSON.stringify($json) }}",
        "options": {}
      },
      "id": "create-request-response",
      "name": "Create Request Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [800, 0]
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

---

## 2. Get Course Requests

### 2.1 Check If Manager (IF Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict",
            "version": 2
          },
          "conditions": [
            {
              "id": "check-manager-role",
              "leftValue": "={{ $json.partnerInfo.role }}",
              "rightValue": "manager",
              "operator": {
                "type": "string",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.2,
      "position": [200, 200],
      "id": "is-manager-get-requests",
      "name": "Is Manager?"
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 2.2 Get All Requests - Manager (Postgres Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT * FROM course_requests\nORDER BY\n  CASE status\n    WHEN 'pending' THEN 1\n    WHEN 'in_moderation' THEN 2\n    ELSE 3\n  END,\n  created_at DESC;",
        "options": {}
      },
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.5,
      "position": [400, 100],
      "id": "get-all-requests",
      "name": "Get All Requests",
      "credentials": {
        "postgres": {
          "id": "YOUR_POSTGRES_CREDENTIAL_ID",
          "name": "Supabase Postgres"
        }
      }
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 2.3 Get Partner Requests - Partner (Postgres Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT * FROM course_requests\nWHERE partner_id = {{ $json.partnerInfo.partnerId }}\nORDER BY created_at DESC;",
        "options": {}
      },
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.5,
      "position": [400, 300],
      "id": "get-partner-requests",
      "name": "Get Partner Requests",
      "credentials": {
        "postgres": {
          "id": "YOUR_POSTGRES_CREDENTIAL_ID",
          "name": "Supabase Postgres"
        }
      }
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 2.4 Map Requests to CamelCase (Code Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "jsCode": "const items = $input.all();\n\nreturn items.map(item => {\n  const row = item.json;\n  return {\n    id: row.id,\n    partnerId: row.partner_id,\n    partnerName: row.partner_name,\n    partnerEmail: row.partner_email,\n    name: row.name,\n    location: row.location,\n    basePrice: parseFloat(row.base_price),\n    partnerDescription: row.partner_description,\n    requestedDates: row.requested_dates,\n    status: row.status,\n    rejectionReason: row.rejection_reason,\n    rejectionRecommendations: row.rejection_recommendations,\n    managerNotes: row.manager_notes,\n    createdCourseId: row.created_course_id,\n    createdAt: row.created_at,\n    updatedAt: row.updated_at\n  };\n});"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [600, 200],
      "id": "map-requests-camelcase",
      "name": "Map to CamelCase"
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 2.5 Get Requests Response (Webhook Response Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ JSON.stringify($input.all().map(i => i.json)) }}",
        "options": {}
      },
      "id": "get-requests-response",
      "name": "Get Requests Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [800, 200]
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

---

## 3. Get Single Course Request

### 3.1 Get Request By ID (Postgres Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT * FROM course_requests WHERE id = {{ $json.body.request_id }};",
        "options": {}
      },
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.5,
      "position": [200, 400],
      "id": "get-request-by-id",
      "name": "Get Request By ID",
      "credentials": {
        "postgres": {
          "id": "YOUR_POSTGRES_CREDENTIAL_ID",
          "name": "Supabase Postgres"
        }
      }
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 3.2 Format Single Request (Code Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "jsCode": "const row = $input.first().json;\n\nif (!row || !row.id) {\n  throw new Error('Request not found');\n}\n\nreturn {\n  id: row.id,\n  partnerId: row.partner_id,\n  partnerName: row.partner_name,\n  partnerEmail: row.partner_email,\n  name: row.name,\n  location: row.location,\n  basePrice: parseFloat(row.base_price),\n  partnerDescription: row.partner_description,\n  requestedDates: row.requested_dates,\n  status: row.status,\n  rejectionReason: row.rejection_reason,\n  rejectionRecommendations: row.rejection_recommendations,\n  managerNotes: row.manager_notes,\n  createdCourseId: row.created_course_id,\n  createdAt: row.created_at,\n  updatedAt: row.updated_at\n};"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [400, 400],
      "id": "format-single-request",
      "name": "Format Single Request"
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 3.3 Single Request Response (Webhook Response Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ JSON.stringify($json) }}",
        "options": {}
      },
      "id": "single-request-response",
      "name": "Single Request Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [600, 400]
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

---

## 4. Update Course Request Status

### 4.1 Check Manager Role (IF Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict",
            "version": 2
          },
          "conditions": [
            {
              "id": "check-manager-update",
              "leftValue": "={{ $json.partnerInfo.role }}",
              "rightValue": "manager",
              "operator": {
                "type": "string",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.2,
      "position": [200, 600],
      "id": "is-manager-update",
      "name": "Is Manager?"
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 4.2 Unauthorized Response (Webhook Response Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ JSON.stringify({ error: 'Unauthorized: Manager role required' }) }}",
        "options": {
          "responseCode": 403
        }
      },
      "id": "unauthorized-response",
      "name": "Unauthorized Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [400, 700]
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 4.3 Update Request Status (Postgres Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "UPDATE course_requests\nSET\n    status = '{{ $json.body.status }}',\n    rejection_reason = CASE WHEN '{{ $json.body.rejectionReason }}' = '' THEN rejection_reason ELSE '{{ $json.body.rejectionReason }}' END,\n    rejection_recommendations = CASE WHEN '{{ $json.body.rejectionRecommendations }}' = '' THEN rejection_recommendations ELSE '{{ $json.body.rejectionRecommendations }}' END,\n    manager_notes = CASE WHEN '{{ $json.body.managerNotes }}' = '' THEN manager_notes ELSE '{{ $json.body.managerNotes }}' END,\n    updated_at = NOW()\nWHERE id = {{ $json.body.request_id }}\nRETURNING *;",
        "options": {}
      },
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.5,
      "position": [400, 500],
      "id": "update-request-status",
      "name": "Update Request Status",
      "credentials": {
        "postgres": {
          "id": "YOUR_POSTGRES_CREDENTIAL_ID",
          "name": "Supabase Postgres"
        }
      }
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 4.4 Check If Rejected (IF Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict",
            "version": 2
          },
          "conditions": [
            {
              "id": "check-rejected",
              "leftValue": "={{ $json.status }}",
              "rightValue": "rejected",
              "operator": {
                "type": "string",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.2,
      "position": [600, 500],
      "id": "is-rejected",
      "name": "Is Rejected?"
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 4.5 Format Update Response (Code Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "jsCode": "const row = $input.first().json;\n\nreturn {\n  id: row.id,\n  partnerId: row.partner_id,\n  partnerName: row.partner_name,\n  partnerEmail: row.partner_email,\n  name: row.name,\n  location: row.location,\n  basePrice: parseFloat(row.base_price),\n  partnerDescription: row.partner_description,\n  requestedDates: row.requested_dates,\n  status: row.status,\n  rejectionReason: row.rejection_reason,\n  rejectionRecommendations: row.rejection_recommendations,\n  managerNotes: row.manager_notes,\n  createdCourseId: row.created_course_id,\n  createdAt: row.created_at,\n  updatedAt: row.updated_at\n};"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [800, 500],
      "id": "format-update-response",
      "name": "Format Update Response"
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 4.6 Update Status Response (Webhook Response Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ JSON.stringify($json) }}",
        "options": {}
      },
      "id": "update-status-response",
      "name": "Update Status Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [1000, 500]
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

---

## 5. Get Partners (Manager Only)

### 5.1 Check Manager (IF Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict",
            "version": 2
          },
          "conditions": [
            {
              "id": "check-manager-partners",
              "leftValue": "={{ $json.partnerInfo.role }}",
              "rightValue": "manager",
              "operator": {
                "type": "string",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.2,
      "position": [200, 800],
      "id": "is-manager-partners",
      "name": "Is Manager?"
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 5.2 Get Operators from Magento (MySQL Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT\n    o.operator_id as id,\n    o.partnername as name,\n    o.contact_email as email,\n    o.name as companyName,\n    (\n        SELECT COUNT(*) FROM catalog_product_entity cpe\n        INNER JOIN catalog_product_entity_varchar cpev\n        ON cpe.entity_id = cpev.entity_id AND cpev.attribute_id = 700\n        WHERE cpev.value = CAST(o.operator_id AS CHAR)\n        AND cpe.type_id = 'configurable'\n    ) as coursesCount\nFROM miomente_pdf_operator o\nWHERE o.status = 1\nORDER BY o.name;"
      },
      "type": "n8n-nodes-base.mySql",
      "typeVersion": 2.4,
      "position": [400, 800],
      "id": "get-operators-magento",
      "name": "Get Operators from Magento",
      "credentials": {
        "mySql": {
          "id": "YOUR_MYSQL_CREDENTIAL_ID",
          "name": "MySQL Magento"
        }
      }
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 5.3 Get Pending Requests Count (Postgres Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT partner_id, COUNT(*) as pending_count\nFROM course_requests\nWHERE status = 'pending'\nGROUP BY partner_id;",
        "options": {}
      },
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.5,
      "position": [400, 900],
      "id": "get-pending-counts",
      "name": "Get Pending Counts",
      "credentials": {
        "postgres": {
          "id": "YOUR_POSTGRES_CREDENTIAL_ID",
          "name": "Supabase Postgres"
        }
      }
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 5.4 Merge Partner Data (Code Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "jsCode": "const operators = $('Get Operators from Magento').all();\nconst pendingCounts = $('Get Pending Counts').all();\n\nconst pendingMap = {};\npendingCounts.forEach(item => {\n  pendingMap[item.json.partner_id] = parseInt(item.json.pending_count);\n});\n\nreturn operators.map(op => ({\n  id: op.json.id,\n  name: op.json.name,\n  email: op.json.email,\n  companyName: op.json.companyName,\n  coursesCount: parseInt(op.json.coursesCount) || 0,\n  pendingRequestsCount: pendingMap[op.json.id] || 0\n}));"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [600, 850],
      "id": "merge-partner-data",
      "name": "Merge Partner Data"
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 5.5 Get Partners Response (Webhook Response Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ JSON.stringify($input.all().map(i => i.json)) }}",
        "options": {}
      },
      "id": "get-partners-response",
      "name": "Get Partners Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [800, 850]
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

---

## 6. Create Course from Request

### 6.1 Check Manager (IF Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict",
            "version": 2
          },
          "conditions": [
            {
              "id": "check-manager-create-course",
              "leftValue": "={{ $json.partnerInfo.role }}",
              "rightValue": "manager",
              "operator": {
                "type": "string",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.2,
      "position": [200, 1000],
      "id": "is-manager-create-course",
      "name": "Is Manager?"
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 6.2 Get Request for Course (Postgres Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT * FROM course_requests WHERE id = {{ $json.body.requestId }};",
        "options": {}
      },
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.5,
      "position": [400, 1000],
      "id": "get-request-for-course",
      "name": "Get Request",
      "credentials": {
        "postgres": {
          "id": "YOUR_POSTGRES_CREDENTIAL_ID",
          "name": "Supabase Postgres"
        }
      }
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 6.3 Prepare Magento Data (Code Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "jsCode": "const request = $('Get Request').first().json;\nconst body = $('Webhook').first().json.body;\nconst operatorId = request.partner_id;\n\nconst timestamp = Date.now();\nconst sku = `PP-${operatorId}-${timestamp}`;\nconst urlKey = request.name\n  .toLowerCase()\n  .replace(/[äöüß]/g, m => ({ä:'ae',ö:'oe',ü:'ue',ß:'ss'})[m])\n  .replace(/[^a-z0-9]+/g, '-')\n  .replace(/-+/g, '-')\n  .replace(/^-|-$/g, '') + '-' + timestamp;\n\nreturn {\n  sku,\n  urlKey,\n  operatorId,\n  name: request.name,\n  subtitle: body.subtitle || '',\n  description: body.description,\n  shortDescription: body.shortDescription,\n  price: parseFloat(request.base_price),\n  location: request.location,\n  beginTime: body.beginTime,\n  endTime: body.endTime,\n  seats: body.seats,\n  participants: body.participants,\n  categoryIds: body.categoryIds,\n  keyword: body.keyword || '',\n  metaTitle: body.metaTitle || request.name,\n  metaDescription: body.metaDescription || '',\n  image: body.image || 'no_selection',\n  requestId: request.id,\n  partnerEmail: request.partner_email,\n  partnerName: request.partner_name\n};"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [600, 1000],
      "id": "prepare-magento-data",
      "name": "Prepare Magento Data"
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 6.4 Create Magento Product (MySQL Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "INSERT INTO catalog_product_entity\n(attribute_set_id, type_id, sku, has_options, required_options, created_at, updated_at)\nVALUES (4, 'configurable', '{{ $json.sku }}', 1, 0, NOW(), NOW());\n\nSET @product_id = LAST_INSERT_ID();\n\nINSERT INTO catalog_product_entity_varchar (attribute_id, store_id, entity_id, value)\nVALUES (73, 0, @product_id, '{{ $json.name }}');\n\nINSERT INTO catalog_product_entity_varchar (attribute_id, store_id, entity_id, value)\nVALUES (97, 0, @product_id, '{{ $json.urlKey }}');\n\nINSERT INTO catalog_product_entity_text (attribute_id, store_id, entity_id, value)\nVALUES (75, 0, @product_id, '{{ $json.description }}');\n\nINSERT INTO catalog_product_entity_text (attribute_id, store_id, entity_id, value)\nVALUES (76, 0, @product_id, '{{ $json.shortDescription }}');\n\nINSERT INTO catalog_product_entity_decimal (attribute_id, store_id, entity_id, value)\nVALUES (77, 0, @product_id, {{ $json.price }});\n\nINSERT INTO catalog_product_entity_int (attribute_id, store_id, entity_id, value)\nVALUES (97, 0, @product_id, 1);\n\nINSERT INTO catalog_product_entity_int (attribute_id, store_id, entity_id, value)\nVALUES (99, 0, @product_id, 4);\n\nINSERT INTO catalog_product_entity_varchar (attribute_id, store_id, entity_id, value)\nVALUES (700, 0, @product_id, '{{ $json.operatorId }}');\n\nINSERT INTO catalog_product_entity_varchar (attribute_id, store_id, entity_id, value)\nVALUES (701, 0, @product_id, '{{ $json.location }}');\n\nSELECT @product_id as entity_id, '{{ $json.sku }}' as sku;"
      },
      "type": "n8n-nodes-base.mySql",
      "typeVersion": 2.4,
      "position": [800, 1000],
      "id": "create-magento-product",
      "name": "Create Magento Product",
      "credentials": {
        "mySql": {
          "id": "YOUR_MYSQL_CREDENTIAL_ID",
          "name": "MySQL Magento"
        }
      }
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 6.5 Update Request to Approved (Postgres Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "UPDATE course_requests\nSET\n    status = 'approved',\n    created_course_id = {{ $('Create Magento Product').first().json.entity_id }},\n    updated_at = NOW()\nWHERE id = {{ $('Prepare Magento Data').first().json.requestId }}\nRETURNING *;",
        "options": {}
      },
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.5,
      "position": [1000, 1000],
      "id": "update-request-approved",
      "name": "Update Request to Approved",
      "credentials": {
        "postgres": {
          "id": "YOUR_POSTGRES_CREDENTIAL_ID",
          "name": "Supabase Postgres"
        }
      }
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 6.6 Format Course Response (Code Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "jsCode": "const product = $('Create Magento Product').first().json;\nconst data = $('Prepare Magento Data').first().json;\n\nreturn {\n  id: product.entity_id,\n  title: data.name,\n  sku: product.sku,\n  status: 'active',\n  description: data.description,\n  basePrice: data.price,\n  location: data.location,\n  image: data.image\n};"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1200, 1000],
      "id": "format-course-response",
      "name": "Format Course Response"
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 6.7 Create Course Response (Webhook Response Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ JSON.stringify($json) }}",
        "options": {}
      },
      "id": "create-course-response",
      "name": "Create Course Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [1400, 1000]
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

---

## 7. Get Partner Courses (Manager Only)

### 7.1 Check Manager (IF Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict",
            "version": 2
          },
          "conditions": [
            {
              "id": "check-manager-partner-courses",
              "leftValue": "={{ $json.partnerInfo.role }}",
              "rightValue": "manager",
              "operator": {
                "type": "string",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.2,
      "position": [200, 1200],
      "id": "is-manager-partner-courses",
      "name": "Is Manager?"
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 7.2 Get Partner Courses (MySQL Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT\n    cpe.entity_id as id,\n    cpe.sku,\n    cpev_name.value as title,\n    cpev_location.value as location,\n    cped_price.value as basePrice,\n    cpei_status.value as status\nFROM catalog_product_entity cpe\nINNER JOIN catalog_product_entity_varchar cpev_op\n    ON cpe.entity_id = cpev_op.entity_id AND cpev_op.attribute_id = 700\nLEFT JOIN catalog_product_entity_varchar cpev_name\n    ON cpe.entity_id = cpev_name.entity_id AND cpev_name.attribute_id = 73 AND cpev_name.store_id = 0\nLEFT JOIN catalog_product_entity_varchar cpev_location\n    ON cpe.entity_id = cpev_location.entity_id AND cpev_location.attribute_id = 701 AND cpev_location.store_id = 0\nLEFT JOIN catalog_product_entity_decimal cped_price\n    ON cpe.entity_id = cped_price.entity_id AND cped_price.attribute_id = 77 AND cped_price.store_id = 0\nLEFT JOIN catalog_product_entity_int cpei_status\n    ON cpe.entity_id = cpei_status.entity_id AND cpei_status.attribute_id = 97 AND cpei_status.store_id = 0\nWHERE cpe.type_id = 'configurable'\n    AND cpev_op.value = '{{ $json.body.partner_id }}'\nORDER BY cpe.created_at DESC;"
      },
      "type": "n8n-nodes-base.mySql",
      "typeVersion": 2.4,
      "position": [400, 1200],
      "id": "get-partner-courses",
      "name": "Get Partner Courses",
      "credentials": {
        "mySql": {
          "id": "YOUR_MYSQL_CREDENTIAL_ID",
          "name": "MySQL Magento"
        }
      }
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 7.3 Partner Courses Response (Webhook Response Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ JSON.stringify($input.all().map(i => i.json)) }}",
        "options": {}
      },
      "id": "partner-courses-response",
      "name": "Partner Courses Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [600, 1200]
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

---

## 8. Login - Обновление для ролей

### 8.1 Get User with Role (Postgres Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT\n    u.id,\n    u.email,\n    u.name,\n    u.password_hash,\n    u.partner_id,\n    u.is_manager\nFROM users u\nWHERE u.email = '{{ $json.body.email }}';",
        "options": {}
      },
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.5,
      "position": [200, 1400],
      "id": "get-user-with-role",
      "name": "Get User with Role",
      "credentials": {
        "postgres": {
          "id": "YOUR_POSTGRES_CREDENTIAL_ID",
          "name": "Supabase Postgres"
        }
      }
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

### 8.2 Format Login Response (Code Node)

```json
{
  "nodes": [
    {
      "parameters": {
        "jsCode": "const user = $input.first().json;\n\n// Здесь добавьте вашу логику генерации JWT токена\nconst token = 'generated_jwt_token';\n\nreturn {\n  email: user.email,\n  name: user.name,\n  token: token,\n  role: user.is_manager ? 'manager' : 'partner',\n  partnerId: user.partner_id,\n  partnerName: user.name\n};"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [400, 1400],
      "id": "format-login-response",
      "name": "Format Login Response"
    }
  ],
  "connections": {},
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true
  }
}
```

---

## Примечания

1. **Замените credential IDs** - В каждом node замените `YOUR_POSTGRES_CREDENTIAL_ID` и `YOUR_MYSQL_CREDENTIAL_ID` на реальные ID ваших credentials.

2. **Attribute IDs** - ID атрибутов в MySQL (73, 75, 76, 77, 97, 99, 700, 701) могут отличаться в вашей установке Magento. Проверьте таблицу `eav_attribute`.

3. **Connections** - После вставки нод, соедините их вручную в нужном порядке.

4. **Position** - Позиции нод можно изменить после вставки, перетаскивая их в редакторе.

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
