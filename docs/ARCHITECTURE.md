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
  └─ adminUsers    parents create kid/device accounts (Cognito admin APIs)

Auth triggers
  ├─ preSignUp        blocks self sign-up once a parent exists (invite-only)
  └─ postConfirmation first confirmed user is added to PARENT
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
| `Child` | name, emoji, color index, birthdate, interests, optional linked Cognito user |
| `DayPlan` | `date` (`YYYY-MM-DD`, identifier), summary, status (draft/published) |
| `AgendaItem` | `date` (indexed), `startTime`/`endTime` (`HH:mm`), `sortOrder`, title, emoji, color token, description, `childIds[]`, status (planned/done/skipped), source (agent/parent/routine), embedded `resources: ResourceRef[]` |
| `ResourceRef` (customType) | label, type (pdf/video/link/note), url, s3Key, description, childIds, prompts, optional `libraryResourceId` |
| `Resource` | reusable library: books, videos, links, worksheets, materials; tags, age range |
| `Routine` | recurring blocks with weekdays and default times; the planner expands them |
| `LearningUnit` | what a child is doing at preschool/school: date range, theme, topics, attachments |
| `Observation` | parent feedback on an item: done, engagement, notes |
| `LearnerProfile` | agent-maintained notes per child: skills emerging/mastered, interests, what works |
| `Conversation` / `Message` | chat history (replaces inbox/outbox JSON + localStorage) |
| `Notification` / `PushSubscription` / `NotificationPrefs` | in-app inbox, per-device push subscriptions, quiet hours and per-type toggles |

Records carry a `householdId` so multi-household hosting remains possible,
even though each deployment is one household.

### Authorization

Cognito groups:

- `PARENT` — full CRUD on everything.
- `CHILD` — read own agenda items, chat in kid mode.
- `DEVICE` — voice device; tutor turns and read access to the current day.

Agent Lambdas get access through `allow.resource(fn)`.

The first confirmed user becomes `PARENT`; afterwards self sign-up is closed and
parents invite others.

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
| `data/agenda.ts` types + `CHILD_COLORS` | `src/lib/agenda.ts` |
| `data/agenda-service.ts`, `data/chat-service.ts` | replaced by Amplify Data (phases 2 and 4) |
| `demo*`, MCP todo example, `db-collections` | dropped |

## Roadmap

1. **Foundation** — remove template leftovers (posts, Prisma, cookie session),
   Tailwind v4, lucide, Biome, port the old UI shell, Cognito groups and the
   first-parent bootstrap.
2. **Data** — schema above, replace the file-based services with Amplify Data,
   `scripts/import-legacy.ts` to load old day JSON files.
3. **Parent management** — pages for children, routines, learning units
   (with uploads), resource library, agenda editing.
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
