---
name: lint-python
description: Run ruff and ty to lint and type check the FastAPI backend project. Use this when the user requests to check the backend code quality or type safety.
---

# Lint Python Skill

This skill allows you to maintain the quality and type safety of the FastAPI backend project using Astral's high-performance tools: `ruff` and `ty`.

## Requirements
The FastAPI project must be managed by `uv` and have `ruff` and `ty` defined in the dev dependencies.

## Workflow

### 1. Preparation
Navigate to the FastAPI backend directory.
```bash
cd backend/fastapi
```

### 2. Linting and Formatting
Run `ruff` to identify linting issues and potential code quality improvements.
```bash
uv run ruff check .
```

To automatically fix issues that can be resolved without human intervention:
```bash
uv run ruff check --fix .
```

### 3. Type Checking
Run `ty` to perform high-speed static type checking across the entire backend codebase.
```bash
uv run ty check .
```

## Guidance
- Use this skill before committing major changes to the backend.
- If errors are found, report them clearly to the user and offer to fix them if possible.
- `ruff` covers linting and formatting, while `ty` covers static type analysis. Both should be used for full coverage.
