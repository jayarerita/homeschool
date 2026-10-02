# Homeschool

An open-source homeschool planner with an AI tutor, built on **TanStack Start**
and deployable to **AWS Amplify Gen 2**. One deployment serves one household.

> Status: early. Authentication, household roles and member invites, child
> profiles, the daily agenda with editing, routines, learning units, a
> resource library, file uploads, the AI tutor, a nightly planner and
> notifications are in place. Kid accounts and the voice device are coming — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
> for the design and roadmap.

## Getting started

Requirements: Node.js 20+, an AWS account, and AWS credentials configured
locally (`aws configure` or SSO).

```bash
npm install
npm run amplify:sandbox   # deploys a personal backend and writes amplify_outputs.json
npm run dev               # http://localhost:3000
```

## Accounts and roles

Household members are grouped in Cognito:

| Group | Access |
|---|---|
| `ADMIN` | Parent who can also invite and manage members |
| `PARENT` | Full access to plans and children |
| `CHILD` | Kid experience (coming in a later phase) |
| `DEVICE` | Voice device (coming in a later phase) |

**The first person to sign up and confirm their email becomes an `ADMIN`
parent.** After that, public sign-up is closed. Admins invite others from
**Settings → Household members**; invitees get an email with a temporary
password.

Children, their label colors, birthdays and other details are set up in
**Settings → Children**. Data from the pre-cloud local app can be loaded in
**Settings → Import**.

## The tutor

An admin chooses which AI the tutor and planner use in **Settings → AI
tutor** (changes apply within a minute, no redeploy):

| Option | Notes |
|---|---|
| **Claude, with an API key** | The most capable tutor (Claude Opus 5.5, or Sonnet 5.5 at about half the cost). Paste a key from console.anthropic.com; it's verified with Anthropic and stored privately in your AWS account. Set a monthly spend limit in the Claude Console. |
| **Claude on Amazon Bedrock** | Claude Sonnet 5 by default (Opus 4.8 / 5.5 and Sonnet 5.5 also selectable), billed through AWS using the backend's IAM role. Your AWS account must be able to use Anthropic models on Bedrock (they're enabled through AWS Marketplace on first use; if Bedrock returns `AccessDeniedException` for Claude, contact AWS Support). |
| **Gemma 4 on Amazon Bedrock** | Works on any AWS account. A noticeably less capable tutor; it can't read PDF or image attachments. |

A Claude Pro or Max subscription can't be used: Anthropic only allows those
plans in its own apps, so third-party apps like this one use an API key.

Until an admin saves a choice, the deployment default applies: Claude on
Bedrock (Claude Sonnet 5), or whatever `TUTOR_PROVIDER` (`bedrock`, `anthropic`,
`bedrock-openai`), `TUTOR_MODEL` and the `ANTHROPIC_API_KEY` sandbox secret set
at deploy time.

## Kid mode and lessons

- **Kid mode** (smiley icon in the header): pick a child and hand over the
  device. It shows that child's day as big cards, and stays locked to their
  view (even after a reload) until a grown-up answers a quick math question.
- **Lessons**: "Let's go!" in kid mode, or "Start a lesson" on any activity,
  opens a full-screen lesson where the tutor talks to the child one step at a
  time. Replies are read aloud and the child can answer with the microphone,
  using the browser's built-in speech (best in Chrome; the microphone is hidden
  where it isn't supported). When the child taps "We're done!", the tutor says
  goodbye, records how it went, and marks the activity done.
- **Worksheets**: ask the tutor for a printable worksheet (tracing, counting,
  matching, coloring) and it attaches one to the activity; "Open worksheet"
  shows it ready to print. Worksheets are shown in a locked-down frame with no
  scripts or outside content.

## Planner and notifications

Every hour a scheduled function checks the household's local time and:

- **drafts upcoming days** with the tutor (4 PM by default): routines plus
  learning activities, saved as a draft you review and **Publish** (or
  **Remove suggestions**). Empty days also have an "Ask the tutor to draft this
  day" button.
- asks **"How did today go?"** (6 PM): tap how an activity went and add a note;
  the tutor reads these when planning.
- sends **materials for tomorrow** (7 PM) and a **weekly preview** (Sunday).

Times, days ahead, the time zone and the planner switch are in **Settings →
Planner & reminders**. Notifications always appear under the bell; each parent
can also get them as:

- **Push notifications** - Settings → Notifications → This device → Turn on.
  Works in desktop browsers and on Android. On iPhone/iPad, add the app to the
  Home Screen first (Share → Add to Home Screen) and turn it on from there.
  Nothing to configure: the push keys are generated automatically.
- **Email** - set a sender address verified in Amazon SES under Planner &
  reminders, then turn on email in your notification settings. New SES
  accounts can only send to verified addresses until AWS grants production
  access.

## Scripts

```bash
npm run dev              # dev server
npm run build            # production build
npm run typecheck        # TypeScript (needs amplify_outputs.json from a sandbox)
npm run test             # unit tests
npm run check            # Biome lint + format check
npm run format           # Biome format
npm run amplify:sandbox  # personal cloud sandbox
```

## License

MIT
