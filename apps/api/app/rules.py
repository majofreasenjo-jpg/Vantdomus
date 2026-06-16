import math

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def calculate_wilson_interval(successes: int, total: int, z: float = 1.96):
    """
    Calculates the Wilson Score Interval for a binomial proportion.
    z=1.96 corresponds to 95% confidence level.
    Returns: (mean_prob * 100, margin_of_error * 100)
    """
    if total == 0:
        return 100.0, 0.0
    
    p = successes / total
    denominator = 1 + z**2 / total
    centre_adjusted_probability = p + z**2 / (2 * total)
    adjusted_standard_deviation = math.sqrt((p * (1 - p) + z**2 / (4 * total)) / total)
    
    lower_bound = (centre_adjusted_probability - z * adjusted_standard_deviation) / denominator
    upper_bound = (centre_adjusted_probability + z * adjusted_standard_deviation) / denominator
    
    mean = (lower_bound + upper_bound) / 2
    margin_of_error = upper_bound - mean
    
    return mean * 100, margin_of_error * 100

def compute_health_score(missed_7d: int, total_meds_7d: int):
    # Probabilidad de adherencia / éxito. (Ej. Si tomo 8 de 10 pastillas = 80% adherencia)
    successes = max(0, total_meds_7d - missed_7d)
    return calculate_wilson_interval(successes, total_meds_7d)

def compute_tasks_score(overdue: int, done_7d: int):
    # Probabilidad de cerrar las tareas a tiempo. Universo activo = listas para hoy o vencidas.
    total = done_7d + overdue
    return calculate_wilson_interval(done_7d, total)

def compute_finance_score(spend_30d_total: float, monthly_budget: float):
    # Probabilidad de adherencia al presupuesto. Modelo continuo invertido.
    if monthly_budget <= 0:
        return 100.0, 0.0
    ratio = spend_30d_total / monthly_budget
    prob = clamp(1.0 - ratio, 0.0, 1.0)
    # Como no es puramente binomial, fijamos un margen de error estático o heurístico.
    # A mayor gasto, más margen de incertidumbre operativa (por imprevistos).
    margin = 5.0 if prob < 0.5 else 2.0
    return prob * 100, margin

def compute_hsi(health_tuple, tasks_tuple, finance_tuple, mode: str):
    h_m, h_e = health_tuple
    t_m, t_e = tasks_tuple
    f_m, f_e = finance_tuple
    
    if mode == "team":
        weights = {"h": 0.2, "t": 0.4, "f": 0.4}
    else:
        weights = {"h": 0.4, "t": 0.3, "f": 0.3}
        
    mean = weights["h"] * h_m + weights["t"] * t_m + weights["f"] * f_m
    # Propagación de error asumiendo variables independientes (Raíz cuadrada de la suma de varianzas).
    variance_sum = (weights["h"] * h_e)**2 + (weights["t"] * t_e)**2 + (weights["f"] * f_e)**2
    err = math.sqrt(variance_sum)
    
    return int(round(mean)), round(err, 1)
