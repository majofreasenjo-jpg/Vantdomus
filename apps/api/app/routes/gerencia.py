from fastapi import APIRouter, Depends
from ..deps import get_db, get_current_user
from ..features import compute_and_store

router = APIRouter(prefix="/gerencia", tags=["Gerencia"])

@router.get("/dashboard")
def get_gerencia_dashboard(user=Depends(get_current_user), db=Depends(get_db)):
    rows = db.execute("""
        SELECT h.id, h.name 
        FROM households h 
        JOIN household_memberships m ON h.id=m.household_id 
        WHERE m.user_id=?
    """, (user["user_id"],)).fetchall()
    
    departments = []
    
    macro_hsi = 0.0
    macro_health = 0.0
    macro_task = 0.0
    macro_finance = 0.0
    
    valid_count = 0
    min_hsi = 100.0
    
    for r in rows:
        hid = r["id"]
        name = r["name"]
        
        f = compute_and_store(db, hid)
        
        hsi = f.get("hsi", 0)
        h_score = f.get("health_score", 0)
        t_score = f.get("task_score", 0)
        fin_score = f.get("finance_score", 0)
        
        departments.append({
            "id": hid,
            "name": name,
            "hsi": hsi,
            "hsi_margin": f.get("hsi_margin", 0),
            "health_score": h_score,
            "task_score": t_score,
            "finance_score": fin_score,
            "mode": f.get("mode", "home")
        })
        
        macro_hsi += hsi
        macro_health += h_score
        macro_task += t_score
        macro_finance += fin_score
        valid_count += 1
        
        if hsi < min_hsi:
            min_hsi = hsi
                
    if valid_count > 0:
        macro_hsi = macro_hsi / valid_count
        macro_health = macro_health / valid_count
        macro_task = macro_task / valid_count
        macro_finance = macro_finance / valid_count
        
        # Penalization algorithm (Fractal Bottleneck)
        penalty_applied = False
        if min_hsi < 60:
            penalty = (60 - min_hsi) * 0.6  # Severe penalization for critical bottleneck
            macro_hsi = max(0, macro_hsi - penalty)
            penalty_applied = True
            
        return {
            "macro_hsi": round(macro_hsi, 1),
            "macro_health": round(macro_health, 1),
            "macro_task": round(macro_task, 1),
            "macro_finance": round(macro_finance, 1),
            "departments": departments,
            "bottleneck_penalty_applied": penalty_applied,
            "min_hsi": round(min_hsi, 1)
        }
        
    return {
        "macro_hsi": 0, "macro_health": 0, "macro_task": 0, "macro_finance": 0, 
        "departments": [], "bottleneck_penalty_applied": False, "min_hsi": 0
    }
