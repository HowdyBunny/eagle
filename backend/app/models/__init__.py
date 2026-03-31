# Import all models so Alembic's Base.metadata sees them
from app.models.candidate import Candidate
from app.models.conversation_log import ConversationLog, ConversationRole
from app.models.embedding import CandidateEmbedding, IndustryKnowledge, RequirementEmbedding
from app.models.preference_log import PreferenceLog
from app.models.project import Project, ProjectMode, ProjectStatus
from app.models.project_candidate import ProjectCandidate, ProjectCandidateStatus
from app.models.project_research import ProjectResearch
from app.models.skill_ontology import SkillOntology

__all__ = [
    "Project",
    "ProjectMode",
    "ProjectStatus",
    "Candidate",
    "ProjectCandidate",
    "ProjectCandidateStatus",
    "PreferenceLog",
    "SkillOntology",
    "ProjectResearch",
    "ConversationLog",
    "ConversationRole",
    "CandidateEmbedding",
    "IndustryKnowledge",
    "RequirementEmbedding",
]
