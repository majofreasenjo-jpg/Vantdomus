import Mathlib
namespace ZeroGradientLean
def traceSpectrum : List ℚ := [0,0,0,0,0,0,8,14,18,20]
def traceConstant : ℚ := 20
def cGammaSqRationalUpper : ℚ := 12042240 / 401287
theorem trace_spectrum_bound : ∀ x ∈ traceSpectrum, x ≤ traceConstant := by
  intro x hx
  simp [traceSpectrum] at hx
  rcases hx with rfl | rfl | rfl | rfl | rfl | rfl | rfl | rfl | rfl | rfl
  all_goals norm_num [traceConstant]
theorem trace_constant_attained : traceConstant ∈ traceSpectrum := by
  simp [traceConstant, traceSpectrum]
theorem cGammaSq_lt_31 : cGammaSqRationalUpper < 31 := by
  norm_num [cGammaSqRationalUpper]
theorem cGamma_over_mu_lt_137_over_250_sq :
    cGammaSqRationalUpper / 100 < (137 / 250 : ℚ) ^ 2 := by
  norm_num [cGammaSqRationalUpper]
end ZeroGradientLean
