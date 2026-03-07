---
description: Run ruff and ty to lint and type check the FastAPI backend project
---

# Lint Python Workflow

This workflow ensures that the FastAPI backend codebase adheres to style guidelines and maintains type safety.

## 1. Preparation
Ensure you are in the backend directory.
```bash
cd backend/fastapi
```

## 2. Linting and Formatting
// turbo
Run `ruff` to identify and fix linting issues or format the code.
```bash
uv run ruff check .
```

## 3. Type Checking
// turbo
Run `ty` to perform high-speed static type checking.
```bash
uv run ty check .
```

## 4. Automatic Fixes (Optional)
If linting issues are found that can be automatically fixed:
```bash
uv run ruff check --fix .
```
