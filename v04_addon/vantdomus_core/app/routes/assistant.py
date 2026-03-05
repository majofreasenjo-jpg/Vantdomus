from fastapi import APIRouter

router = APIRouter(prefix="/assistant", tags=["Assistant"])

@router.get("/status")
def status():
    return {
        "assistant": "Planning Assistant v0.4 active",
        "mode": "heuristic + ML-ready base"
    }
