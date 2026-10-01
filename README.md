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

The tutor runs on Claude. By default it uses **Claude Opus 4.8 in Amazon
Bedrock** with the backend's own IAM role - no API key and no model-access
request needed, since Opus 4.8 is open to every Bedrock account. Deploy
(`npm run amplify:sandbox`) and the tutor appears in the chat panel.

Claude Opus 5.5 is gated per AWS account on Bedrock. Once your account has
access (Bedrock → Model access), deploy with
`TUTOR_MODEL=anthropic.claude-opus-5-5`.

To use the Claude API instead:

```bash
npx ampx sandbox secret set ANTHROPIC_API_KEY
TUTOR_PROVIDER=anthropic npm run amplify:sandbox
```

Set `TUTOR_MODEL` at deploy time to use a different model (Bedrock model IDs
start with `anthropic.`).

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
