# Homeschool

An open-source homeschool planner with an AI tutor, built on **TanStack Start**
and deployable to **AWS Amplify Gen 2**. One deployment serves one household.

> Status: early. Authentication, household roles and member invites, child
> profiles, the daily agenda with editing, routines, learning units, a
> resource library and file uploads are in place. The tutor agent and
> notifications are coming — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
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
