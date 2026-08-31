# CommitEase Frontend

Next.js frontend for CommitEase, the multi-tenant contribution and treasury platform for masjid committees.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- TanStack Query
- Zustand
- Axios
- React Hook Form
- Zod

## Application Role

This frontend provides the user-facing workflows for platform administration, committee operations and member access. It communicates with the CommitEase REST API and enforces route/session behavior through the Next.js application layer and middleware.

The wider product includes member management, contribution plans, dues, payment workflows, receipts, treasury accounts, expenses, reports and role-based committee operations.

## Local Development

```bash
npm install
npm run dev
```

The development server runs on `http://localhost:3000` by default.

## Quality Checks

```bash
npm run lint
npm run build
```

## Repository Context

For architecture, backend setup and the full domain model, see the root [`README.md`](../README.md).
