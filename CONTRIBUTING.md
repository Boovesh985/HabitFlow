# Contributing to HabitFlow

Thanks for your interest in contributing to HabitFlow! Here's how to get started.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork locally
3. **Set up** the development environment (see [README.md](README.md#1-run-it-locally-development))
4. **Create a branch** for your feature or fix: `git checkout -b feature/your-feature`

## Development

```bash
# Start the dev database
docker compose -f docker-compose.dev.yml up -d

# Start the API (terminal 1)
cd server
npm install
npx prisma migrate dev
npm run dev

# Start the web app (terminal 2)
cd client
npm install
npm run dev
```

Run tests before submitting:

```bash
cd server && npm test
```

## Pull Requests

1. Keep PRs focused — one feature or fix per PR
2. Update or add tests if your change affects the streak engine or API routes
3. Make sure existing tests pass
4. Write a clear PR description explaining **what** changed and **why**

## Code Style

- TypeScript throughout (client and server)
- Prisma for all database access — no raw SQL
- Zod for request validation on the server
- Use existing patterns in the codebase as reference

## Reporting Issues

Open an issue with:
- A clear title and description
- Steps to reproduce (if it's a bug)
- Expected vs actual behavior
- Screenshots if applicable

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
