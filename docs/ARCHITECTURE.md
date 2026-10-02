# Homeschool — Architecture & Roadmap

An open-source homeschool planner with an AI tutor, deployable by anyone to
AWS Amplify Gen 2. It replaces a local TanStack Start app (see `docs/old_app/`)
that read daily agendas from JSON files and talked to a NanoClaw agent through
an inbox/outbox directory.

## Goals

- Daily agenda per household, filterable by child, printable.
- Everything persisted in DynamoDB (no local JSON files).
- A cloud agent that feels like a real tutor: knows each child, the plan, what
  they're doing at preschool/school, and learns from parent feedback.
- Multiple users: parents (full control), kids (later, limited), devices
  (later, a voice speaker).
- Notifications for upcoming plans, materials to gather, and feedback requests.
- Easy self-hosting: one Amplify deployment = one household.

## System overview

```
TanStack Start (Amplify Hosting SSR)
  ├─ AppSync (Amplify Data) ──► DynamoDB (models below)
  ├─ Amplify Storage (S3)  ──► uploads (preschool newsletters, photos), generated worksheets
  └─ Service worker (PWA)  ──► Web Push

Lambdas (defineFunction) — share tutor-core/ (Claude client, context, tools, agent loop)
  ├─ tutor-turn      one chat turn; invoked by an async AppSync mutation
  └─ household-jobs  hourly: drafts upcoming days, feedback/materials/weekly
                     notifications, Web Push + SES delivery; also serves
                     pushPublicKey, sendTestNotification, draftDay

Auth stack
  ├─ preSignUp        blocks self sign-up once an admin exists (invite-only)
  ├─ postConfirmation first confirmed user is added to ADMIN + PARENT
  └─ manageMembers    admin-only AppSync resolvers: list/invite/re-role/remove
                      members (lives in the auth stack; in the data stack it
                      creates an auth <-> data circular dependency)
```

### Tutor (`amplify/functions/tutor-turn/`)

One Lambda runs a tutor turn; the planner and the voice device will reuse its
modules (client, context, tools) rather than a second agent.

- **Flow**: the browser writes the user `TutorMessage` and an empty assistant
  `TutorMessage` (`status: pending`), then calls the `runTutorTurn` mutation,
  which invokes the Lambda asynchronously. The Lambda streams Claude's reply
  into the assistant message (throttled updates, `status: streaming` → `done`
  or `error`); the UI watches with `observeQuery`.
- **Model**: adaptive thinking at `medium` effort. By default Claude Sonnet 5
  via Claude in Amazon Bedrock (`anthropic.claude-sonnet-5`, open to every
  Bedrock account; Lambda IAM role, `bedrock-mantle:CreateInference`).
  Sonnet 5 doesn't accept mid-conversation system messages, so for it the
  per-turn context is folded into the user turn (`foldSystemMessages`).
  `TUTOR_MODEL` overrides it (e.g. `anthropic.claude-opus-5-5`, which Bedrock
  gates per account). Alternatively the Claude API (Opus 5.5) with an
  `ANTHROPIC_API_KEY` secret and `TUTOR_PROVIDER=anthropic`, or any model on
  Bedrock's OpenAI-compatible endpoint (`TUTOR_PROVIDER=bedrock-openai`,
  default `google.gemma-4-31b`; `tutor-core/openai-compatible.ts` converts
  the stored Claude-format conversation to Chat Completions and back, signing
  with SigV4). The agent loop only sees the `ModelClient` interface
  (`tutor-core/model.ts`).
  An admin picks the provider and model in Settings (`aiSettings` /
  `setAiSettings`, served by household-jobs); the choice and any Claude API
  key are stored at `system/ai-provider.json` in the household bucket (not
  browser-readable, SSE), cached for a minute in the Lambdas, and fall back to
  the deploy-time environment when unset (`tutor-core/ai-config.ts`). Refusal
  fallbacks: server-side `fallbacks: "default"` on the Claude API; the SDK's
  client-side middleware to Opus 4.8 on Bedrock when the main model differs.
- **History**: each completed turn's exact API messages (user message, the
  per-turn context message, assistant content including thinking blocks, tool
  results) are stored in S3 at `tutor/<conversationId>/<messageId>.json` and
  replayed unchanged on later turns - append-only, as preserved thinking and
  prompt caching require, and without DynamoDB's 400 KB item limit. Failed or
  refused turns are not saved. After a mid-output refusal fallback, blocks
  before the boundary are filtered per the API rules (`echo.ts`).
- **Context**: a stable, cached system prompt (`prompt.ts`) plus a per-turn
  mid-conversation system message (`context.ts`) with today's date in the
  household time zone, who is speaking, each child's details and learner
  profile, learning units for the next two weeks, and today's plan.
- **Tools** (`tools.ts`, zod-validated, eager input streaming): `get_agenda`,
  `add_agenda_item`, `update_agenda_item`, `delete_agenda_item`,
  `list_routines`, `list_learning_units`, `search_library`,
  `add_library_resource`, `record_observation`, `get_observations`,
  `update_learner_profile`, `read_file` (uploads only; PDFs and images are
  passed to the model directly).
- **Modes**: parent planning conversations, and lesson conversations started
  from an agenda item, where the tutor speaks to the child in short, plain,
  read-aloud-friendly sentences.

Chosen over Amplify AI Kit (`a.conversation`) because the same core must be
callable from a scheduled job and a physical device, not only a chat route.

## Data model (Amplify `a.model` → DynamoDB)

| Model | Purpose |
|---|---|
| `Child` | name, emoji, label color (palette token), birthdate, grade level, interests, tutor notes, sort order, archived. Managed by parents in Settings |
| `DayPlan` | `date` (`YYYY-MM-DD`, identifier), summary, status (draft/published) |
| `AgendaItem` | `date` (indexed, sorted by `sortOrder`), `startTime`/`endTime` (`HH:mm`), title, emoji, color (palette token), description, `childIds[]`, status (planned/done/skipped), source (parent/agent/routine/import), `routineId`, embedded `resources: ResourceRef[]` |
| `ResourceRef` (customType) | a copy of a resource on one item or routine: label, type, url, s3Key, description, childIds, prompts, optional `libraryResourceId` |
| `ResourceType` (enum) | link, video, pdf, note, book, material (physical supplies — feeds "materials for tomorrow") |
| `LibraryResource` | reusable library entry: same fields as `ResourceRef` plus tags and age range |
| `Routine` | recurring block: weekdays, default times, children, resources, active flag. Added to a day from the agenda (and by the planner later) |
| `LearningUnit` | what a child is doing at preschool/school: source, date range, theme, topics, notes, `attachments: Attachment[]` |
| `Attachment` (customType) | a stored file: s3Key, name, content type |
| `Observation` | parent feedback on an item: done, engagement, notes |
| `LearnerProfile` | tutor-maintained notes per child (keyed by child): skills emerging/mastered, interests, what works |
| `Conversation` / `TutorMessage` | chat threads (parent or lesson mode) and the messages shown in the UI; verbatim API transcripts live in S3 (replaces inbox/outbox JSON + localStorage) |
| `Notification` / `PushSubscription` / `NotificationPrefs` | in-app inbox, per-device push subscriptions, quiet hours and per-type toggles |

Agenda items keep their order in `sortOrder` with gaps of 10; a new item is
slotted in by start time and only renumbers neighbours when no gap is left
(`src/lib/planning.ts`). Items copy resources rather than referencing the
library, so editing or deleting a library entry never changes past days.

Files live in Amplify Storage under `uploads/<uuid>/<name>`: parents can
read/write/delete, kids and devices can read.

Colors are stored as palette tokens (`amplify/data/colors.ts`), never
Tailwind classes; `src/lib/colors.ts` maps tokens to classes. Nothing about a
particular family (names, colors, ages) is hardcoded.

Each deployment is one household, so records carry no household id. Hosting
several households in one deployment would need one added.

### Authorization

Cognito groups:

- `ADMIN` — an add-on to `PARENT`: can invite, re-role and remove members.
- `PARENT` — full CRUD on everything.
- `CHILD` — read own agenda items, chat in kid mode.
- `DEVICE` — voice device; tutor turns and read access to the current day.

Agent Lambdas get access through `allow.resource(fn)`.

The first confirmed user becomes `ADMIN` + `PARENT`; afterwards self sign-up
is closed and admins invite others by email (Cognito sends a temporary
password). Every member has exactly one base role (`PARENT`, `CHILD` or
`DEVICE`); `ADMIN` is only valid on parents. Admins can't demote or remove
themselves, so a household always keeps at least one admin.

## Planner and notifications (`amplify/functions/household-jobs/`)

One Lambda runs **every hour** and also serves `pushPublicKey`,
`sendTestNotification` and `draftDay` (async). Each tick reads
`HouseholdSettings` (singleton `id: "household"`: time zone, job hours,
planner switch, app URL, SES sender), computes the household-local hour, and
runs whatever is due (`schedule.ts`):

- **planner** (default 16:00): for the next 1-3 days without a `DayPlan`,
  create a `draft` DayPlan, add the weekday's routines deterministically, then
  run the tutor agent (`tutor-core/agent.ts`) with planner instructions and a
  context focused on that day. The agent's closing summary goes into
  `DayPlan.summary` (which also tells the app the draft finished) and a
  `plan_ready` notification. Parents **Publish** or **Remove suggestions**
  (deletes `source: agent` items).
- **feedback** (18:00): today's non-routine activities that have ended without
  an `Observation`. Parents answer with a quick engagement tap + note per
  activity, stored as observations for the tutor.
- **materials** (19:00): `material` resources on tomorrow's items.
- **weekly preview** (Sunday 17:00): planned days, running units, materials.

A job is due once its hour has passed; `Notification.dedupeKey` (indexed)
stops repeats, so a missed tick catches up. The tutor and planner share
`tutor-core/` (Claude client, context, tools, agent loop).

**Delivery**: `Notification` rows are household-wide (parents only), with
`readBy` / `deliveredTo` lists of Cognito usernames. After the jobs, each tick
delivers notifications from the last 36 hours to every parent not yet
delivered: skipped if already read in-app or the type is muted in their
`NotificationPrefs`; held while they are in quiet hours. Channels:

- **Web Push** via `web-push`, to each `PushSubscription` (owner-scoped; one per
  browser). VAPID keys are generated on first use and stored in the bucket at
  `system/vapid.json` (not browser-readable) - no setup for self-hosters.
  Expired subscriptions (404/410) are deleted. `public/sw.js` shows the
  notification and opens its in-app link.
- **Email** via Amazon SES when the household has a verified sender and the
  parent opted in.

Owner-authorized records store `owner` as `sub::username` but read back as the
username, so recipients are keyed by username throughout.

## Voice device (later)

Raspberry Pi-class device with mic and speaker: local wake word → speech-to-text
(Amazon Transcribe streaming or Whisper) → `tutorTurn` in voice mode,
authenticated as a `DEVICE` Cognito user → text-to-speech (Amazon Polly or
similar). It can join the active lesson session so it knows the current
exercise. No backend redesign is needed because the agent core does not
depend on the input channel.

## What is recycled from the old app

| Old file | New home |
|---|---|
| `routes/index.tsx` (daily view, child tabs) | `src/routes/_authed/index.tsx` |
| `components/AgendaItem.tsx` | `src/components/AgendaItem.tsx` |
| `components/CalendarDropdown.tsx` | `src/components/CalendarDropdown.tsx` |
| `components/ChatPanel.tsx` | `src/components/ChatPanel.tsx` (rewired to Amplify Data in phase 4) |
| `routes/print.tsx` | `src/routes/_authed/print.tsx` |
| `data/agenda.ts` types | generated from the schema (`src/lib/agenda.ts`) |
| `CHILD_COLORS` (by child position) | per-child color chosen in Settings (`src/lib/colors.ts`) |
| `data/agenda-service.ts` | `src/lib/agenda.ts` (Amplify Data) |
| `data/chat-service.ts` | replaced in phase 4 |
| day JSON files | Settings → Import (`src/lib/legacy-import.ts`) |
| `demo*`, MCP todo example, `db-collections` | dropped |

## Roadmap

1. **Foundation** — remove template leftovers (posts, Prisma, cookie session),
   Tailwind v4, lucide, Biome, port the old UI shell, Cognito groups and the
   first-parent bootstrap.
2. **Data + household admin** — `Child`, `DayPlan`, `AgendaItem` models; the
   agenda reads from Amplify Data; Settings page for children (colors,
   birthdays, details) and members (admin only); in-browser import of old day
   JSON files.
3. **Planning** — add/edit/reorder/delete agenda items with resources and
   file uploads; routines (added to a day in one click); learning units with
   attachments shown on matching days; resource library.
4. **Tutor v1** — `tutor-turn` Lambda, tools, learner profiles and
   observations, live chat through AppSync subscriptions, lesson
   conversations started from an activity.
5. **Planner + notifications** — hourly household jobs, draft-day review,
   activity feedback, in-app notifications, Web Push, optional SES email.
6. **Lesson mode + kid accounts** — guided session UI, kid UI, worksheet
   generation from `prompts` stored in S3.
7. **Voice device** — device client, `DEVICE` group, voice pipeline.
8. **Open-source polish** — deploy guide (Amplify deploy, secrets, Bedrock
   model access), seed data, contributing guide.

## Default decisions (revisit as needed)

- Bedrock by default (Claude Sonnet 5), Anthropic API optional.
- Kids use "kid mode" on a parent's device until phase 6.
- One household per deployment.
- The planner creates **draft** days that a parent publishes.
