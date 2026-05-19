# Спецификация: Незнакомые треки и AI-привязка

## 1. Суть фичи

В систему доставки приходят посылки, чьих трек-номеров нет в нашей базе (vision-парсер ebay_orders их не увидел, либо реальный трек отличается от того что значится в eBay). Форвардер должен иметь возможность:

1. Завести «незнакомый трек» (с фото или без него; возможно даже без номера трека, только фото запчасти).
2. Получить помощь AI-агента в идентификации: к какому из активных eBay-заказов привязать.
3. Через workflow согласования (форвардер → админ) подтвердить привязку. При подтверждении трек дописывается в удалённую БД `ebay_orders` как дополнительный (extra) трек уже существующего заказа.
4. Принятые «незнакомые треки» дальше живут как обычные посылки в системе.

«Незнакомый трек», существующий в системе доставки, но ещё не привязанный к eBay-заказу, можно включать в отгрузку КГ→РФ и идентифицировать уже после фактического прибытия в РФ.

## 2. Термины

- **Заявка** (`lookup_request`) — основная сущность фичи: запись с опц. трек-номером, опц. фото, комментарием, статусом, чатом с AI и историей. Заявки общие — видны всем форвардерам и админам.
- **Незнакомый трек / orphan-parcel** — посылка в локальной БД `parcels`, помеченная `is_manual=true`, без связанной строки в `ebay_remote.orders` (FDW-поля = NULL).
- **Extra-трек** — трек добавленный системой delivery в массив `orders.delivery_extra_tracks` удалённой БД ebay_orders. Это и есть «принятая привязка».
- **Прямое доказательство** — AI нашёл явное совпадение (трек/SKU на фото; продавец+дата; несколько подтверждающих факторов). Возвращается единственный `direct_match`.
- **Предположение** — частичное совпадение (только SKU, или только дата); возвращается ранжированный список `candidates`. Если AI не может предложить кандидатов — возвращает только уточняющие `questions`. Врать запрещено.

## 3. Архитектура

Три БД на хосте `194.164.245.107`:

| БД | Порт | Назначение | Кто пишет |
|---|---|---|---|
| `ebay_orders` | 5405 | Источник заказов eBay | Vision-парсер ebay_orders + delivery (только в `delivery_extra_tracks*`) |
| `delivery` | 5404 | Локальная БД проекта delivery (parcels, photos, history) | API delivery |
| `delivery_agent` | 5412 | Заявки, чаты, attachments AI-агента | API delivery |

LLM:
- `LLM_BASE_URL=http://194.164.245.107:8317/v1`, `LLM_API_KEY=local-gpt55`, модель `cursor-gpt55(high)` (имя передаётся как есть, reasoning effort встроен в название).
- Все вызовы LLM — на Python-бекенде через `openai` SDK с `base_url=LLM_BASE_URL`.
- Vision: фото передаются как `image_url` content parts (`data:...;base64,...` либо MinIO URL).

UI чата:
- Vercel AI SDK `useChat` на фронте (Next.js).
- Next.js Route Handler — тонкий прокси, ничего не вызывает напрямую: пайпит stream от FastAPI к браузеру.
- FastAPI стримит ответ в формате `UIMessageStream` (SSE), совместимом с `useChat`.

## 4. Изменения БД

### 4.1. ebay_orders (новая миграция)

Добавляются колонки в таблицу `orders`:

```sql
ALTER TABLE orders
  ADD COLUMN delivery_extra_tracks TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN delivery_extra_tracks_meta JSONB NOT NULL DEFAULT '[]'::jsonb;
```

`delivery_extra_tracks_meta` — массив объектов вида:
```json
{ "track": "...", "added_by_login": "...", "added_at": "...", "request_id": "..." }
```

Логика заполнения:
- **Vision-парсер** ebay_orders не трогает эти колонки (пишет только в `order_tracking_numbers`).
- **Delivery** (только при подтверждённой админом привязке) делает UPDATE с `array_append`.
- В функции проверки уникальности трека (`ebay_orders/app/tools.py`, _detect_tracking_conflicts_) добавляется чтение `delivery_extra_tracks`. При конфликте — запись в новую таблицу `tracking_conflicts(detected_at, tracking_number, ebay_order_id, delivery_order_id, note)`, без авто-перезаписи. Кейс маловероятный — обрабатывается логированием, без интерактива.
- Промпты vision получают строку «треки из `delivery_extra_tracks` не дублируй».

### 4.2. delivery (новая миграция)

```sql
ALTER TABLE parcels_mutations
  ADD COLUMN is_manual BOOLEAN NOT NULL DEFAULT false;
```

VIEW `parcels` остаётся прежней (LEFT JOIN с FDW). Для `is_manual=true` парселей FDW-поля возвращаются `NULL` пока не появится привязка через `delivery_extra_tracks` (после следующего sync).

Sync-воркер: расширить запрос — забирать треки и из `order_tracking_numbers`, и из `unnest(orders.delivery_extra_tracks)`. Идемпотентность сохраняется (ON CONFLICT DO NOTHING).

Manual-парсель допускает произвольный стартовый статус (форвардер указывает при создании заявки или при принятии «как orphan в отгрузку»: чаще всего `arrived_kg` или `in_shipment_kg_to_ru`).

### 4.3. delivery_agent (новая БД)

```sql
CREATE TABLE lookup_requests (
  id UUID PRIMARY KEY,
  tracking_number TEXT,                    -- nullable: можно начать с одних фото
  note TEXT,                               -- свободный комментарий форвардера
  status TEXT NOT NULL,                    -- draft | searching | pending_admin | linked | rejected | deleted
  linked_order_id BIGINT,                  -- id заказа в ebay_orders при linked
  linked_evidence TEXT,                    -- цитата обоснования AI или текст админа
  created_by_login TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_by_login TEXT,                 -- кто отправил админу на подтверждение
  submitted_at TIMESTAMPTZ,
  decided_by_login TEXT,                   -- кто принял/отклонил
  decided_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  deleted_by_login TEXT
);

CREATE TABLE lookup_request_photos (
  id UUID PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES lookup_requests(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL,
  public_url TEXT,
  mime_type TEXT,
  bytes BIGINT,
  uploaded_by_login TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL                     -- 'initial' | 'chat'
);

CREATE TABLE ai_conversations (
  request_id UUID PRIMARY KEY REFERENCES lookup_requests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ai_messages (
  id UUID PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES lookup_requests(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                      -- system | user | assistant
  author_login TEXT,                       -- кто написал (NULL для assistant/system)
  content_text TEXT,
  attachments JSONB,                       -- [{object_key, mime}], для user-сообщений
  structured JSONB,                        -- для assistant: {direct_match, candidates[], questions[], reasoning}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tracking_conflicts_log (...);
```

Один диалог на одну заявку (PK `request_id`).

## 5. Жизненный цикл заявки

```
draft → searching → (pending_admin | rejected) → linked
                ↑___________________│ (новый раунд AI после ответа человека)
```

| Статус | Описание |
|---|---|
| `draft` | Заявка создана, AI не запущен |
| `searching` | Идёт диалог: ждём ответа AI или ответа человека |
| `pending_admin` | Форвардер выбрал вариант и отправил админу на подтверждение |
| `linked` | Админ подтвердил, трек записан в `delivery_extra_tracks` |
| `rejected` | Админ отклонил вариант (диалог можно возобновить) |
| `deleted` | Soft-delete админом (фото в MinIO остаются) |

Откат `linked` запрещён (UI: предупреждение «принятые привязки изменяются только разработчиком»).

Админ может миновать `pending_admin` и сразу подтверждать привязку, если работает с заявкой сам.

## 6. AI-агент

### 6.1. Контекст (передаётся при каждом запросе)

Системный промпт + текущий снимок данных:

- **Список заказов** из `ebay_remote.orders` со статусами:
  - все из `parcels` за исключением `cancelled` и `delivered_ru` старше 14 дней;
  - вместе с item_titles, ordered_at, sold_by, order_total_usd, текущими треками (включая extra), вычисленным статусом доставки и датами этапов.
- **Заявка**: трек (если есть), комментарий, все фото (initial + chat) как `image_url` content parts.
- **История диалога**: все предыдущие сообщения (truncate не делаем — пусть модель сама режет, не заморачиваемся).
- **Системные инструкции**:
  - Возвращай structured JSON: `{ direct_match: {order_id, evidence} | null, candidates: [{order_id, reason, confidence}], questions: [string], reasoning: string }`.
  - Если нет прямых доказательств и нет правдоподобных кандидатов — пустые `candidates`, заполни `questions`.
  - Не выдумывай совпадений (анти-галлюцинация).
  - Не раскрывай в reasoning цены и продавцов сверх необходимого; общайся на русском.

### 6.2. Запуск

- Кнопка «Запросить AI» на странице заявки. Может нажать форвардер или админ. Допустим повторный запуск (после новых фото/реплик).
- Бекенд: FastAPI `POST /requests/{id}/ai/messages` (если пользователь добавил сообщение) → формирует payload → стримит ответ.

### 6.3. Структурированный вывод

AI возвращает structured-блок. Хранится в `ai_messages.structured`. UI рендерит:
- direct_match: одна жирная карточка «Точное совпадение: заказ #N» + evidence + кнопка «Это правильно, отправить админу».
- candidates: список карточек с обоснованиями.
- questions: подсвечиваются над полем ввода.
- Если AI вернул только questions — кнопок «отправить админу» нет.

## 7. Workflow привязки

1. Форвардер выбирает на карточке AI «это правильный матч» → заявка → `pending_admin`, `submitted_by_login`/`submitted_at` фиксируются.
2. Админ открывает заявку (видна с бейджиком), жмёт «Подтвердить» → бекенд:
   - проверяет, что у заявки есть `tracking_number` (если нет — модал «введите трек прежде чем подтвердить»);
   - выполняет в `ebay_remote.orders` (через FDW либо отдельный asyncpg-пул к 5405) `UPDATE orders SET delivery_extra_tracks = array_append(...), delivery_extra_tracks_meta = ...` для выбранного `linked_order_id`;
   - ставит `status='linked'`, `decided_by_login`, `decided_at`;
   - если в `parcels_mutations` ещё нет соответствующей строки — создаёт (`is_manual=false`, sync дальше всё подтянет автоматически). Если строка уже была (orphan-parcel), помечает её как обычную, и она получит FDW-поля при следующем sync.
   - запись в `parcel_history` через триггер/код с note `linked from request {id} by {login}`.
3. «Отклонить» → `status='rejected'`. Заявка остаётся в общем пуле, диалог можно продолжить.

## 8. Orphan-parcel в отгрузке

При создании заявки с трек-номером (но без привязки к eBay) — сразу создаётся строка в `parcels_mutations` (`is_manual=true`, статус указанный форвардером, обычно `arrived_kg` или `in_shipment_kg_to_ru`). Эту строку можно добавить в shipment KG→РФ как обычный parcel.

После прибытия в РФ или в любой момент — форвардер/админ открывает заявку, продолжает поиск, привязывает к eBay-заказу. Привязка не меняет shipment_id или статус парселя.

В основных списках треков (`/admin`, `/forwarder`) orphan-parcel **не показывается по умолчанию**. Показывается:
- На отдельной странице «Незнакомые треки».
- В shipment, к которой он добавлен (с плашкой «нет привязки к eBay»).
- В поиске по трек-номеру.

## 9. Доступ и аудит

| Действие | Forwarder | Admin |
|---|---|---|
| Создать заявку | ✓ | ✓ |
| Грузить фото | ✓ | ✓ |
| Писать в чат | ✓ | ✓ |
| Запускать AI | ✓ | ✓ |
| Отправить на подтверждение | ✓ | (минует — сразу принимает) |
| Подтвердить → запись в ebay_remote | ✗ | ✓ |
| Отклонить | ✗ | ✓ |
| Удалить заявку | ✗ | ✓ (soft) |

Авторство фиксируется логином пользователя (`users.login` в delivery). В `delivery_extra_tracks_meta` пишется login (а не uuid), чтобы межсистемная история оставалась читаемой.

## 10. Веб-интерфейс

Новые экраны:

- `/admin/unknown` и `/forwarder/unknown` — отдельная страница со списком заявок (фильтры по статусу, сортировка: pending_admin сверху → searching → linked → rejected).
- `/admin/unknown/[id]` (и зеркало у форвардера) — страница заявки: шапка с метаданными, секция фото (initial + chat), AI-чат, секция «Связь» (показывается при `pending_admin`/`linked`).
- Кнопка в шапке у обеих ролей: «Незнакомые треки» с бейджиком количества `pending_admin` (для админа) и `searching` (для форвардера, чтобы видеть что AI ответил).
- На странице обычного трека (`/admin/track/[tn]`) для is_manual треков — плашка «Незнакомый трек» + ссылка на связанную заявку.

Стиль — единый с проектом (Fraunces serif, cream + coral; см. существующие компоненты), без новых дизайн-систем.

## 11. API (FastAPI)

```
POST   /requests                              # создать заявку
GET    /requests                              # список (фильтры по статусу)
GET    /requests/{id}                         # детали + чат
POST   /requests/{id}/photos                  # загрузить фото (initial / chat)
POST   /requests/{id}/messages                # человек пишет сообщение
POST   /requests/{id}/ai/run                  # запустить AI-итерацию (SSE-стрим)
POST   /requests/{id}/submit                  # форвардер → pending_admin (с выбранным order_id)
POST   /requests/{id}/approve                 # админ → linked (с order_id; запись в ebay_remote)
POST   /requests/{id}/reject                  # админ → rejected
DELETE /requests/{id}                         # админ → soft delete
```

Фото в MinIO: тот же бакет `parts-photos`, префикс `delivery/lookup/{request_id}/`.

## 12. Конфигурация

Новые переменные `.env`:

```
LLM_BASE_URL=http://194.164.245.107:8317/v1
LLM_API_KEY=local-gpt55
LLM_MODEL=cursor-gpt55(high)
DELIVERY_AGENT_PG_DSN=postgres://admin:Password123@194.164.245.107:5412/delivery_agent
```

`docker-compose.yml`: `delivery-api` и `delivery-sync` получают новые env. Деплой проходит штатно через существующий пайплайн (без новых сервисов).

## 13. Тесты и применение

- Тестов автоматических не добавляется; ручное тестирование через UI.
- Миграции применяет разработчик (Claude) через psql после backup всех трёх БД.
- Файлы миграций:
  - `delivery/sql/006_manual_lookup.sql`
  - `ebay_orders/db/migrations/00X_delivery_extra_tracks.sql`
  - `delivery_agent/sql/001_init.sql` (новый каталог в проекте delivery, либо отдельный — определяется при реализации).

## 14. Что НЕ делается

- Откат принятой привязки (только через ручное вмешательство разработчика).
- Авто-разрешение конфликтов уникальности треков (только лог).
- Permissions-фильтрация AI-контекста по роли (общий контекст; в промпте — инструкция «не палить данные»).
- Lite/мобильный UI для AI-чата.
- Embeddings/семантический поиск отдельно от LLM.
- Notifications (email / push) — только бейджик в шапке.
