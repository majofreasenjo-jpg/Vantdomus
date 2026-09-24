import Mathlib
import ZeroGradientLean.Geometry
import ZeroGradientLean.Argyris
import ZeroGradientLean.Nitsche

noncomputable section

namespace ZeroGradientLean

/-- Rationalized residual coefficient used by the selected formal core.  The
paper's certified decimal lower coefficient is larger. -/
def residualFloor : ℝ := 1409 / 500000

/-- Rationalized velocity response coefficient.  It is deliberately below the
paper's certified 0.001820757... value. -/
def velocityFloor : ℝ := 91 / 50000

/-- Pure scalar implication from residual lower bound and Nitsche continuity. -/
theorem residual_forces_velocity
    {h r u : ℝ}
    (hh : 0 ≤ h)
    (hr : residualFloor * Real.sqrt h ≤ r)
    (hru : r ≤ (387 / 250 : ℝ) * u) :
    velocityFloor * Real.sqrt h ≤ u := by
  have hs : 0 ≤ Real.sqrt h := Real.sqrt_nonneg h
  have hcoef : velocityFloor * (387 / 250 : ℝ) < residualFloor := by
    norm_num [velocityFloor, residualFloor]
  nlinarith

/-- Polynomial contradiction at the heart of the rate obstruction.  Put
`hGamma=t^2`; then the certified lower response is c*t while an H^(3/2)
upper rate is at most 2*C*t^3. -/
theorem sqrt_vs_three_halves_contradiction
    {c C t : ℝ}
    (hc : 0 < c) (hC : 0 < C) (ht : 0 < t)
    (ht2 : t ^ 2 < c / (2 * C)) :
    ¬ (c * t ≤ 2 * C * t ^ 3) := by
  intro hbad
  have h2C : 0 < 2 * C := by positivity
  have hscaled : 2 * C * t ^ 2 < c := by
    apply (lt_div_iff₀ h2C).mp at ht2
    nlinarith
  nlinarith [mul_lt_mul_of_pos_right hscaled ht]

/-- Selected-core theorem: once the FEM/geometry layers supply the certified
response lower bound and the global fourth-order term is dominated by the
same h^(3/2) scale, no refinement-independent rate constant can survive all
sufficiently small members of the family. -/
theorem no_universal_h32_rate_at_small_scale
    {C t : ℝ}
    (hC : 0 < C) (ht : 0 < t)
    (ht2 : t ^ 2 < velocityFloor / (2 * C)) :
    ¬ (velocityFloor * t ≤ 2 * C * t ^ 3) := by
  exact sqrt_vs_three_halves_contradiction
    (c := velocityFloor) (C := C) (t := t)
    (by norm_num [velocityFloor]) hC ht ht2

end ZeroGradientLean
