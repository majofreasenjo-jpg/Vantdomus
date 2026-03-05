def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def compute_health_score(missed_7d: int):
    return clamp(100 - missed_7d * 15, 0, 100)

def compute_tasks_score(overdue: int, done_7d: int):
    base = 60 + done_7d * 8 - overdue * 12
    return clamp(base, 0, 100)

def compute_finance_score(spend_30d_total: float, monthly_budget: float):
    if monthly_budget <= 0:
        return 70
    ratio = spend_30d_total / monthly_budget
    score = 100 - (ratio - 0.8) * 150
    return clamp(int(score), 0, 100)

def compute_hsi(health: int, tasks: int, finance: int, mode: str):
    if mode == "team":
        return int(round(tasks*0.4 + finance*0.4 + health*0.2))
    return int(round(health*0.4 + tasks*0.3 + finance*0.3))
