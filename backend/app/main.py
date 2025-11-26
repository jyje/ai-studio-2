"""FastAPI application entry point."""

from fastapi import FastAPI
from app.core.middleware import setup_cors_middleware
from app.chat.routes import router as chat_router

app = FastAPI()

# Setup middleware
setup_cors_middleware(app)

# Register routers
app.include_router(chat_router)


@app.get('/')
def read_root():
    """Root endpoint for health check."""
    return {'Hello': 'World'}
