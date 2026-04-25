# CLAUDE.md

## Project Overview
Automation monorepo containing multiple projects (email-blaster, task-manager, etc.).

## Allowed Operations
- Read, write, edit, and create any project files (code, config, assets)
- Run build commands (`npm run build`, `next build`, etc.)
- Run dev servers (`npm run dev`, `npm start`, etc.)
- Run tests (`npm test`, `jest`, `vitest`, etc.)
- Install/update dependencies (`npm install`, `npm update`, `pip install`, etc.)
- Run linters and formatters (`eslint`, `prettier`, `black`, etc.)
- Run database migrations and seeds
- Execute scripts in the project
- Create and modify directories
- Access localhost and local network services

## Denied Operations — DO NOT perform any of these:

### Credentials & Secrets
- Do NOT read, write, display, or modify `.env`, `.env.*`, `credentials.json`, `serviceAccountKey.json`, or any file containing API keys, tokens, passwords, or secrets
- Do NOT access or modify SSH keys, PGP keys, or certificate files (`*.pem`, `*.key`, `*.crt`)
- Do NOT log, echo, or print environment variables that may contain secrets
- Do NOT access password managers, keychains, or credential stores

### Git & Version Control
- Do NOT run `git push`, `git push --force`, `git reset --hard`, `git checkout .`, `git clean`
- Do NOT amend commits, rebase, or delete branches
- Do NOT modify `.gitconfig` or git hooks
- Do NOT create tags or releases
- Allowed: `git status`, `git diff`, `git log`, `git add`, `git commit` (only when explicitly asked)

### Payment & Financial Apps
- Do NOT access, open, or interact with any payment applications (Stripe, PayPal, Razorpay, Square, etc.)
- Do NOT modify payment-related code without explicit user confirmation
- Do NOT process, display, or store payment card numbers, bank details, or financial credentials
- Do NOT make any API calls to payment gateways or billing services

### System Apps & External Applications
- Do NOT open, launch, or interact with desktop applications (browsers, file managers, editors, etc.)
- Do NOT install system-level software or modify system configuration
- Do NOT access or modify files outside the project directory (`d:\Users\Meet\Desktop\automation`)
- Do NOT interact with OS-level services, registries, or system processes
- Do NOT send emails, messages, or make network requests to external services (except localhost)
