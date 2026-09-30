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

Lambdas (defineFunction) — all share one "agent core"
  ├─ tutorTurn     one chat/voice turn; invoked by an async AppSync mutation
  ├─ planner       scheduled (nightly + Sunday): drafts upcoming days, materials, feedback asks
  ├─ notifier      Web Push + SES email; driven by new Notification rows

Auth stack
  ├─ preSignUp        blocks self sign-up once an admin exists (invite-only)
  ├─ postConfirmation first confirmed user is added to ADMIN + PARENT
  └─ manageMembers    admin-only AppSync resolvers: list/invite/re-role/remove
                      members (lives in the auth stack; in the data stack it
                      creates an auth <-> data circular dependency)
```

### Agent core (`amplify/agent/`)

One brain used by chat, the scheduled planner and the future voice device:

- **Model client** behind a small interface. Default: Amazon Bedrock (IAM, no
  keys). Optional: Anthropic API via `secret('ANTHROPIC_API_KEY')`. Verify the
  Claude model IDs available in your Bedrock region before choosing one.
- **Context** assembled per turn: today's plan, active child, learner profile,
  active learning units, recent observations.
- **Tools**: `getDay`, `upsertAgendaItem`, `addResource`, `searchResourceLibrary`,
  `recordObservation`, `updateLearnerProfile`, `createNotification`,
  `readUpload` (PDF/image uploads read directly by the model).
- **Modes**: parent-planning (concise), lesson (guides an agenda item step by
  step, age-appropriate, Socratic, records observations), voice style (short
  spoken sentences, no markdown).

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
| `LearnerProfile` | agent-maintained notes per child: skills emerging/mastered, interests, what works |
| `Conversation` / `Message` | chat history (replaces inbox/outbox JSON + localStorage) |
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

## Notifications

- PWA + service worker + Web Push (VAPID keys stored as Amplify secrets).
  Works on desktop, Android, and iOS 16.4+ when installed to the home screen.
- SES email fallback (new SES accounts are sandboxed; verify addresses).
- Triggers: evening "materials for tomorrow", Sunday weekly preview,
  "how did X go?" when an item ends without an observation, and agent questions.

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
4. **Tutor v1** — agent core, `tutorTurn`, tools, learner profiles, live chat
   through AppSync subscriptions.
5. **Planner + notifications** — scheduled planner, notification models, PWA,
   Web Push, SES.
6. **Lesson mode + kid accounts** — guided session UI, kid UI, worksheet
   generation from `prompts` stored in S3.
7. **Voice device** — device client, `DEVICE` group, voice pipeline.
8. **Open-source polish** — deploy guide (Amplify deploy, secrets, Bedrock
   model access), seed data, contributing guide.

## Default decisions (revisit as needed)

- Bedrock by default, Anthropic API optional.
- Kids use "kid mode" on a parent's device until phase 6.
- One household per deployment.
- The planner creates **draft** days that a parent publishes.
