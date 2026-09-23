import Mathlib

noncomputable section

namespace ZeroGradientLean

theorem dual_norm_lower_from_witness
    {E : Type*} [NormedAddCommGroup E] [NormedSpace ℝ E]
    (R : E →L[ℝ] ℝ) (v : E) (hv : 0 < ‖v‖) :
    |R v| / ‖v‖ ≤ ‖R‖ := by
  have h := R.le_opNorm v
  have h' : |R v| ≤ ‖R‖ * ‖v‖ := by
    simpa [Real.norm_eq_abs] using h
  exact (div_le_iff₀ hv).2 (by simpa [mul_comm] using h')

theorem residual_response_lower
    {res M u : ℝ}
    (hM : 0 < M)
    (hres : 0 ≤ res)
    (hcont : res ≤ M * u) :
    res / M ≤ u := by
  exact (div_le_iff₀ hM).2 (by simpa [mul_comm] using hcont)

end ZeroGradientLean
