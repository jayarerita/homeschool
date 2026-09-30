# Homeschool

An open-source homeschool planner with an AI tutor, built on **TanStack Start**
and deployable to **AWS Amplify Gen 2**. One deployment serves one household.

> Status: early. Phase 1 (foundation) is in place: authentication, household
> roles, and the daily agenda UI. Data storage, the tutor agent, and
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
| `PARENT` | Full access |
| `CHILD` | Kid experience (coming in a later phase) |
| `DEVICE` | Voice device (coming in a later phase) |

**The first person to sign up and confirm their email becomes a `PARENT`.**
After that, public sign-up is closed; additional accounts must be added by a
parent (an in-app invite flow is planned — until then, create users and assign
groups in the Cognito console).

## Scripts

```bash
npm run dev              # dev server
npm run build            # production build
npm run typecheck        # TypeScript
npm run check            # Biome lint + format check
npm run format           # Biome format
npm run amplify:sandbox  # personal cloud sandbox
```

## License

MIT
