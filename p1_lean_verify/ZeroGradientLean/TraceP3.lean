import Mathlib

namespace ZeroGradientLean

/-- Ordered generalized eigenvalue multiset from the exact P3 volume/edge Gram
replay. -/
def traceSpectrum : List ℚ := [0, 0, 0, 0, 0, 0, 8, 14, 18, 20]

def traceConstant : ℚ := 20

def cGammaSqRationalUpper : ℚ := 12042240 / 401287

/-- Every explicitly listed generalized eigenvalue is at most 20. -/
theorem trace_spectrum_bound :
    ∀ x ∈ traceSpectrum, x ≤ traceConstant := by
  intro x hx
  simp [traceSpectrum] at hx
  rcases hx with rfl | rfl | rfl | rfl | rfl | rfl | rfl | rfl | rfl | rfl
  all_goals norm_num [traceConstant]

/-- The sharp endpoint 20 actually occurs in the exact spectrum. -/
theorem trace_constant_attained : traceConstant ∈ traceSpectrum := by
  simp [traceConstant, traceSpectrum]

/-- Target-native inverse-trace constant is below 31, a deliberately loose
rational ceiling used by the selected formal core. -/
theorem cGammaSq_lt_31 : cGammaSqRationalUpper < 31 := by
  norm_num [cGammaSqRationalUpper]

/-- More precise square comparison used for the Nitsche stability layer. -/
theorem cGamma_over_mu_lt_137_over_250_sq :
    cGammaSqRationalUpper / 100 < (137 / 250 : ℚ) ^ 2 := by
  norm_num [cGammaSqRationalUpper]

end ZeroGradientLean
