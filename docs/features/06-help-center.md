# Feature 06: Help Center / FAQ

**Priority:** Low
**Status:** Planned
**Reference:** partner.gokonfetti.com
**Estimated Effort:** 1-2 weeks

---

## Table of Contents

1. [Overview](#overview)
2. [User Stories](#user-stories)
3. [Functional Requirements](#functional-requirements)
4. [Technical Architecture](#technical-architecture)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [UI Components](#ui-components)
8. [Content Structure](#content-structure)
9. [Implementation Tasks](#implementation-tasks)

---

## Overview

A self-service help center with FAQ articles, guides, and documentation for partners. Reduces support tickets and provides 24/7 assistance.

### Problem Statement

- Partners frequently ask the same questions
- Support team handles many simple queries
- No central place for documentation
- Partners unsure how to use portal features

### Solution

A comprehensive help center with:
1. Searchable FAQ articles
2. Category-based organization
3. Step-by-step guides with screenshots
4. Multi-language support (DE/EN)
5. Manager-editable content (CMS)
6. Related article suggestions
7. "Was this helpful?" feedback

---

## User Stories

### Partner Stories

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-1 | As a partner, I want to search for help articles | Search returns relevant results |
| US-2 | As a partner, I want to browse help by category | Category navigation works |
| US-3 | As a partner, I want articles in my language | DE/EN support |
| US-4 | As a partner, I want to report if article was helpful | Feedback buttons work |
| US-5 | As a partner, I want to contact support from help center | Contact link/form available |

### Manager Stories

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-6 | As a manager, I want to create help articles | WYSIWYG editor available |
| US-7 | As a manager, I want to organize articles by category | Category management |
| US-8 | As a manager, I want to see article analytics | View counts, helpful ratings |
| US-9 | As a manager, I want to update articles easily | Edit existing articles |

---

## Functional Requirements

### FR-1: Article Display

| Requirement | Description |
|-------------|-------------|
| FR-1.1 | Display articles with formatted content |
| FR-1.2 | Support markdown or rich text |
| FR-1.3 | Embed images and screenshots |
| FR-1.4 | Show related articles |
| FR-1.5 | Display last updated date |
| FR-1.6 | Mobile-responsive layout |

### FR-2: Search

| Requirement | Description |
|-------------|-------------|
| FR-2.1 | Full-text search across articles |
| FR-2.2 | Search by title and content |
| FR-2.3 | Highlight matching terms |
| FR-2.4 | Suggest articles as user types |
| FR-2.5 | Track search queries for analytics |

### FR-3: Categories

| Requirement | Description |
|-------------|-------------|
| FR-3.1 | Organize articles into categories |
| FR-3.2 | Category icons/colors |
| FR-3.3 | Nested categories (optional) |
| FR-3.4 | Featured/popular articles per category |

### FR-4: Multi-language

| Requirement | Description |
|-------------|-------------|
| FR-4.1 | Articles in German and English |
| FR-4.2 | Language selector on help pages |
| FR-4.3 | Fallback to German if EN not available |
| FR-4.4 | Sync article IDs across languages |

### FR-5: Feedback

| Requirement | Description |
|-------------|-------------|
| FR-5.1 | "Was this helpful?" Yes/No buttons |
| FR-5.2 | Optional feedback text on "No" |
| FR-5.3 | Track helpful ratings per article |
| FR-5.4 | Report low-rated articles to managers |

### FR-6: CMS (Manager)

| Requirement | Description |
|-------------|-------------|
| FR-6.1 | Create new articles |
| FR-6.2 | Edit existing articles |
| FR-6.3 | Archive/unpublish articles |
| FR-6.4 | Manage categories |
| FR-6.5 | Upload images |
| FR-6.6 | Preview before publishing |

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Help Center                                     │
│                                                                          │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐   │
│  │    Partner      │     │    Manager      │     │    Public       │   │
│  │   Help Pages    │     │    CMS Pages    │     │   (Optional)    │   │
│  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘   │
│           │                       │                       │             │
│           └───────────────────────┼───────────────────────┘             │
│                                   │                                      │
│                          ┌────────▼────────┐                            │
│                          │   Help API      │                            │
│                          └────────┬────────┘                            │
│                                   │                                      │
└───────────────────────────────────┼──────────────────────────────────────┘
                                    │
                           ┌────────▼────────┐
                           │   PostgreSQL    │
                           │  - Articles     │
                           │  - Categories   │
                           │  - Feedback     │
                           │  - Analytics    │
                           └─────────────────┘
```

### Search Implementation Options

1. **PostgreSQL Full-Text Search** (Simple, no extra infra)
   - Built-in `tsvector` and `tsquery`
   - Good for German with `german` dictionary

2. **Meilisearch** (Better UX, separate service)
   - Typo-tolerant
   - Instant search
   - Faceted filtering

3. **Algolia** (SaaS, best UX, cost)
   - Hosted search
   - Excellent relevance
   - Analytics included

**Recommendation:** Start with PostgreSQL full-text, upgrade later if needed.

---

## Database Schema

### PostgreSQL: Help Center Tables

```sql
-- Categories
CREATE TABLE miomente_partner_portal_help_categories (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(100) UNIQUE NOT NULL,
  name_de VARCHAR(255) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  description_de TEXT,
  description_en TEXT,
  icon VARCHAR(50),
  color VARCHAR(20),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Articles
CREATE TABLE miomente_partner_portal_help_articles (
  id SERIAL PRIMARY KEY,
  category_id INT REFERENCES miomente_partner_portal_help_categories(id),
  slug VARCHAR(200) UNIQUE NOT NULL,

  -- German content
  title_de VARCHAR(255) NOT NULL,
  excerpt_de TEXT,
  content_de TEXT NOT NULL,

  -- English content
  title_en VARCHAR(255),
  excerpt_en TEXT,
  content_en TEXT,

  -- SEO/Meta
  meta_title_de VARCHAR(255),
  meta_title_en VARCHAR(255),
  meta_description_de TEXT,
  meta_description_en TEXT,

  -- Status
  status VARCHAR(20) DEFAULT 'draft', -- draft, published, archived
  is_featured BOOLEAN DEFAULT false,
  published_at TIMESTAMP,

  -- Search (PostgreSQL tsvector)
  search_vector_de TSVECTOR,
  search_vector_en TSVECTOR,

  -- Analytics
  view_count INT DEFAULT 0,
  helpful_yes INT DEFAULT 0,
  helpful_no INT DEFAULT 0,

  -- Audit
  created_by VARCHAR(100),
  updated_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Full-text search indexes
CREATE INDEX idx_help_articles_search_de ON miomente_partner_portal_help_articles
  USING GIN(search_vector_de);
CREATE INDEX idx_help_articles_search_en ON miomente_partner_portal_help_articles
  USING GIN(search_vector_en);

-- Update search vectors on insert/update
CREATE OR REPLACE FUNCTION update_help_article_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector_de = to_tsvector('german', COALESCE(NEW.title_de, '') || ' ' || COALESCE(NEW.content_de, ''));
  NEW.search_vector_en = to_tsvector('english', COALESCE(NEW.title_en, '') || ' ' || COALESCE(NEW.content_en, ''));
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER help_article_search_update
  BEFORE INSERT OR UPDATE ON miomente_partner_portal_help_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_help_article_search_vector();

-- Related articles (many-to-many)
CREATE TABLE miomente_partner_portal_help_related (
  article_id INT REFERENCES miomente_partner_portal_help_articles(id),
  related_article_id INT REFERENCES miomente_partner_portal_help_articles(id),
  PRIMARY KEY (article_id, related_article_id)
);

-- Feedback tracking
CREATE TABLE miomente_partner_portal_help_feedback (
  id SERIAL PRIMARY KEY,
  article_id INT REFERENCES miomente_partner_portal_help_articles(id),
  is_helpful BOOLEAN NOT NULL,
  feedback_text TEXT,
  customer_number VARCHAR(50),
  session_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Search analytics
CREATE TABLE miomente_partner_portal_help_searches (
  id SERIAL PRIMARY KEY,
  query VARCHAR(255) NOT NULL,
  results_count INT,
  clicked_article_id INT REFERENCES miomente_partner_portal_help_articles(id),
  language VARCHAR(2),
  customer_number VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Endpoints

### Public/Partner Endpoints

#### GET /api/help/categories

List all help categories.

```typescript
// Response
{
  data: {
    categories: Array<{
      id: number;
      slug: string;
      name: string;
      description: string;
      icon: string;
      articleCount: number;
    }>;
  };
}
```

#### GET /api/help/articles

List articles with optional filters.

```typescript
// Query params: category, search, featured, page, limit, language

// Response
{
  data: {
    articles: Array<{
      id: number;
      slug: string;
      title: string;
      excerpt: string;
      category: { id: number; name: string; };
      isFeatured: boolean;
      publishedAt: string;
    }>;
    pagination: {...};
  };
}
```

#### GET /api/help/articles/:slug

Get single article.

```typescript
// Response
{
  data: {
    article: {
      id: number;
      slug: string;
      title: string;
      content: string; // HTML or Markdown
      category: {...};
      relatedArticles: Array<{...}>;
      publishedAt: string;
      updatedAt: string;
    };
  };
}
```

#### GET /api/help/search

Search articles.

```typescript
// Query params: q, language, limit

// Response
{
  data: {
    results: Array<{
      id: number;
      slug: string;
      title: string;
      excerpt: string;
      highlights: string[]; // Matching snippets
      category: {...};
    }>;
    total: number;
  };
}
```

#### POST /api/help/articles/:id/feedback

Submit article feedback.

```typescript
// Request
{
  isHelpful: boolean;
  feedbackText?: string;
}

// Response
{
  success: true;
  message: string;
}
```

### Manager Endpoints

#### POST /api/admin/help/articles

Create new article.

#### PUT /api/admin/help/articles/:id

Update article.

#### DELETE /api/admin/help/articles/:id

Archive article.

#### GET /api/admin/help/analytics

Get help center analytics.

---

## UI Components

### Help Center Home

```
┌─────────────────────────────────────────────────────────────────┐
│  Hilfe-Center                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 🔍 Wie können wir Ihnen helfen?                            │ │
│  │ [Suchen Sie nach Artikeln...                           ]   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Beliebte Themen:                                               │
│  [Kurs erstellen] [Termine hinzufügen] [Buchungen verwalten]   │
│                                                                  │
│  ────────────────────────────────────────────────────────────── │
│                                                                  │
│  Kategorien:                                                    │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ 📚 Erste Schritte │  │ 📅 Kursverwaltung │                    │
│  │                   │  │                   │                    │
│  │ 5 Artikel        │  │ 8 Artikel        │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ 📋 Buchungen     │  │ 💰 Abrechnung    │                    │
│  │                   │  │                   │                    │
│  │ 6 Artikel        │  │ 4 Artikel        │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ ⚙️ Einstellungen │  │ 📞 Kontakt       │                    │
│  │                   │  │                   │                    │
│  │ 3 Artikel        │  │ Support-Anfrage  │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Category Page

```
┌─────────────────────────────────────────────────────────────────┐
│  📅 Kursverwaltung                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [← Zurück zum Hilfe-Center]                                    │
│                                                                  │
│  Alles rund um das Erstellen und Verwalten Ihrer Kurse.        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 📄 Neuen Kurs erstellen                                    │ │
│  │    Schritt-für-Schritt Anleitung zum Anlegen eines Kurses │ │
│  │    Aktualisiert: vor 2 Tagen                               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 📄 Termine hinzufügen und verwalten                        │ │
│  │    So fügen Sie neue Termine zu Ihrem Kurs hinzu          │ │
│  │    Aktualisiert: vor 1 Woche                               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 📄 Kursbilder und Beschreibungen optimieren                │ │
│  │    Tipps für ansprechende Kurspräsentationen              │ │
│  │    Aktualisiert: vor 3 Wochen                              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Article Page

```
┌─────────────────────────────────────────────────────────────────┐
│  Neuen Kurs erstellen                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [← Kursverwaltung]                                             │
│                                                                  │
│  Aktualisiert: 15. Januar 2025                                  │
│                                                                  │
│  ────────────────────────────────────────────────────────────── │
│                                                                  │
│  In diesem Artikel erfahren Sie, wie Sie einen neuen Kurs      │
│  im Partner-Portal anlegen.                                     │
│                                                                  │
│  ## Voraussetzungen                                             │
│                                                                  │
│  - Aktiver Partner-Account                                      │
│  - Mindestens ein Kursbild (1200x800px empfohlen)              │
│                                                                  │
│  ## Schritt 1: Kurseditor öffnen                               │
│                                                                  │
│  Navigieren Sie zu **Kurse** → **Neuer Kurs**.                 │
│                                                                  │
│  [Screenshot: Navigation zum Kurseditor]                        │
│                                                                  │
│  ## Schritt 2: Grunddaten eingeben                             │
│                                                                  │
│  Füllen Sie die folgenden Felder aus:                          │
│  - **Kursname**: Ein prägnanter, beschreibender Titel          │
│  - **Beschreibung**: Detaillierte Kursbeschreibung             │
│  - **Kategorie**: Wählen Sie die passende Kategorie            │
│                                                                  │
│  [Screenshot: Grunddaten-Formular]                              │
│                                                                  │
│  ...                                                            │
│                                                                  │
│  ────────────────────────────────────────────────────────────── │
│                                                                  │
│  War dieser Artikel hilfreich?                                  │
│  [👍 Ja]  [👎 Nein]                                             │
│                                                                  │
│  ────────────────────────────────────────────────────────────── │
│                                                                  │
│  Verwandte Artikel:                                             │
│  • Termine hinzufügen und verwalten                             │
│  • Kursbilder optimieren                                        │
│  • Preise und Rabatte einstellen                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Manager: Article Editor

```
┌─────────────────────────────────────────────────────────────────┐
│  Artikel bearbeiten                                      [X]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Sprache: [🇩🇪 Deutsch ▼]                                       │
│                                                                  │
│  Titel: *                                                       │
│  [Neuen Kurs erstellen                                    ]     │
│                                                                  │
│  Slug:                                                          │
│  [neuen-kurs-erstellen                                    ]     │
│                                                                  │
│  Kategorie: *                                                   │
│  [Kursverwaltung                                          ▼]    │
│                                                                  │
│  Kurzfassung:                                                   │
│  [Schritt-für-Schritt Anleitung zum Anlegen eines Kurses ]     │
│                                                                  │
│  Inhalt: *                                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ [B] [I] [H1] [H2] [Link] [Image] [Code] [List]            │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │                                                             │ │
│  │ In diesem Artikel erfahren Sie, wie Sie einen neuen        │ │
│  │ Kurs im Partner-Portal anlegen.                            │ │
│  │                                                             │ │
│  │ ## Voraussetzungen                                          │ │
│  │                                                             │ │
│  │ - Aktiver Partner-Account                                   │ │
│  │ - Mindestens ein Kursbild...                               │ │
│  │                                                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ☐ Als Featured markieren                                       │
│                                                                  │
│  Status: [Entwurf ▼]                                            │
│                                                                  │
│            [Vorschau]  [Speichern]  [Veröffentlichen]           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Content Structure

### Suggested Categories

| Category | Icon | Articles |
|----------|------|----------|
| Erste Schritte | 📚 | Welcome, Account setup, Portal overview |
| Kursverwaltung | 📅 | Create course, Edit course, Add dates, Images |
| Buchungen | 📋 | View bookings, Confirm/decline, Rebooking |
| Abrechnung | 💰 | View revenue, Invoices, Payouts |
| Einstellungen | ⚙️ | Profile, Password, Notifications |
| Kontakt | 📞 | Support form, Contact info, Emergency |

### Sample Article Structure

```markdown
# [Article Title]

[Brief introduction - what will the reader learn?]

## Prerequisites (if applicable)
- Requirement 1
- Requirement 2

## Step 1: [Action]
[Explanation]

![Screenshot description](image-url)

## Step 2: [Action]
[Explanation]

> **Tip:** [Helpful tip for this step]

## Step 3: [Action]
[Explanation]

## Troubleshooting (if applicable)

### Problem 1
Solution...

### Problem 2
Solution...

## Related Articles
- [Link to related article 1]
- [Link to related article 2]
```

---

## Implementation Tasks

### Phase 1: Database & Core (Days 1-3)

| Task | Description |
|------|-------------|
| 1.1 | Create database tables |
| 1.2 | Set up full-text search |
| 1.3 | Create API endpoints (read) |

### Phase 2: Partner UI (Days 4-6)

| Task | Description |
|------|-------------|
| 2.1 | Help center home page |
| 2.2 | Category page |
| 2.3 | Article page |
| 2.4 | Search functionality |
| 2.5 | Feedback component |

### Phase 3: Manager CMS (Days 7-10)

| Task | Description |
|------|-------------|
| 3.1 | Article editor (WYSIWYG) |
| 3.2 | Category management |
| 3.3 | Image upload |
| 3.4 | Preview functionality |

### Phase 4: Content & Polish (Days 11-14)

| Task | Description |
|------|-------------|
| 4.1 | Write initial articles (DE) |
| 4.2 | Translate to English |
| 4.3 | Add screenshots |
| 4.4 | Analytics dashboard |

---

## File Structure

```
src/
├── app/
│   ├── dashboard/
│   │   └── help/
│   │       ├── page.tsx              # Help center home
│   │       ├── [category]/
│   │       │   └── page.tsx          # Category page
│   │       └── article/
│   │           └── [slug]/
│   │               └── page.tsx      # Article page
│   ├── admin/
│   │   └── help/
│   │       ├── page.tsx              # Article list
│   │       ├── new/
│   │       │   └── page.tsx          # New article
│   │       ├── [id]/
│   │       │   └── page.tsx          # Edit article
│   │       └── categories/
│   │           └── page.tsx          # Category management
│   └── api/
│       └── help/
│           ├── categories/
│           │   └── route.ts
│           ├── articles/
│           │   └── route.ts
│           ├── search/
│           │   └── route.ts
│           └── feedback/
│               └── route.ts
├── components/
│   ├── help/
│   │   ├── article-card.tsx
│   │   ├── category-card.tsx
│   │   ├── search-input.tsx
│   │   ├── feedback-widget.tsx
│   │   └── article-editor.tsx
│   └── ...
└── lib/
    └── db/
        └── queries/
            └── help.ts
```

---

## Dependencies

**New dependencies:**
- `@tiptap/react` or `react-quill` - WYSIWYG editor
- `marked` or `react-markdown` - Markdown rendering
- `highlight.js` - Code highlighting (optional)

---

## Open Questions

1. **Editor choice:** TipTap vs Quill vs simple Markdown?
2. **Public access:** Should help center be public or login required?
3. **Video content:** Support embedded videos (YouTube)?
4. **Versioning:** Track article revision history?
5. **Translations:** Use translation service or manual?

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2025-01-21 | Claude | Initial specification created |
