# Homeschool

An open-source homeschool planner with an AI tutor, built on **TanStack Start**
and deployable to **AWS Amplify Gen 2**. One deployment serves one household.

> Status: early. Authentication, household roles and member invites, child
> profiles, the daily agenda with editing, routines, learning units, a
> resource library, file uploads and the AI tutor are in place.
> Notifications are coming — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
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

The tutor runs on Claude. By default it uses **Claude in Amazon Bedrock** with
the backend's own IAM role - no API key needed:

1. In the AWS console, open **Amazon Bedrock → Model access** in the region you
   deploy to and make sure **Claude Opus 5.5** is enabled (Claude Opus 4.8,
   used as a fallback, is open to all accounts).
2. Deploy (`npm run amplify:sandbox`). The tutor appears in the chat panel.

To use the Claude API instead:

```bash
npx ampx sandbox secret set ANTHROPIC_API_KEY
TUTOR_PROVIDER=anthropic npm run amplify:sandbox
```

Set `TUTOR_MODEL` at deploy time to use a different model (Bedrock model IDs
start with `anthropic.`).

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
