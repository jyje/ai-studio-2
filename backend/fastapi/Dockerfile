# ============================================
# Production Dockerfile (Multi-stage build)
# ============================================

# Stage 1: Builder - Install dependencies
FROM python:3.14-slim AS builder

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy dependency files
COPY pyproject.toml ./

# Create virtual environment
RUN uv venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

# Install dependencies without editable install (app directory doesn't exist yet)
RUN uv pip install --no-cache \
    fastapi \
    uvicorn \
    openai

# Copy application code
COPY . .

# Now install the package in editable mode
RUN uv pip install --no-cache -e .

# Stage 2: Runner - Minimal runtime image
FROM python:3.14-slim AS runner

WORKDIR /app

# Create a non-root user for security
RUN groupadd --system --gid 1001 appuser && \
    useradd --system --uid 1001 --gid appuser appuser

# Copy virtual environment from builder
COPY --from=builder --chown=appuser:appuser /app/.venv /app/.venv

# Copy application code
COPY --from=builder --chown=appuser:appuser /app /app

# Set environment variables
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]