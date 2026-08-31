import os
import logging
from fastapi import APIRouter
from api.routers.chat import router as chat_router
from api.routers.characters import router as characters_router
from api.routers.memory import router as memory_router
from api.routers.audio import router as audio_router
from api.routers.system import router as system_router
from graph.checkpoint_manager import auto_maintain_checkpoints_if_needed

logger = logging.getLogger("Routes")

router = APIRouter()

# 聚合五大高内聚领域子路由
router.include_router(chat_router)
router.include_router(characters_router)
router.include_router(memory_router)
router.include_router(audio_router)
router.include_router(system_router)

# 服务启动时自动检测并维护 LangGraph 检查点数据库 (防止无限膨胀)
try:
    auto_maintain_checkpoints_if_needed(threshold_mb=100.0)
except Exception as e:
    logger.warning(f"Auto maintenance of checkpoints failed on startup: {e}")
