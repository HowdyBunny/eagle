from fastapi import FastAPI

from app.api import (
    candidates,
    conversations,
    evaluations,
    health,
    ontology,
    preferences,
    projects,
    research,
)


def register_routers(app: FastAPI) -> None:
    app.include_router(health.router, prefix="/api")
    app.include_router(projects.router, prefix="/api")
    app.include_router(candidates.router, prefix="/api")
    app.include_router(evaluations.router, prefix="/api")
    app.include_router(conversations.router, prefix="/api")
    app.include_router(preferences.router, prefix="/api")
    app.include_router(research.router, prefix="/api")
    app.include_router(ontology.router, prefix="/api")
