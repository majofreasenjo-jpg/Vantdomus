import Mathlib
import ZeroGradientLean.TraceP3

noncomputable section

namespace ZeroGradientLean

/-- Scalar 2x2 inequality underlying symmetric Nitsche coercivity. -/
theorem nitsche_two_by_two_lower
    {x y a : ℝ} (ha0 : 0 ≤ a) (ha1 : a ≤ 1) :
    (1 - a) * (x ^ 2 + y ^ 2) ≤ x ^ 2 + y ^ 2 - 2 * a * x * y := by
  have hs : 0 ≤ a * (x - y) ^ 2 := mul_nonneg ha0 (sq_nonneg (x - y))
  nlinarith

/-- Rational selected-core envelope for sqrt(C_Gamma^2 / 100).  The exact
manuscript uses the sharper decimal value; this formal layer freezes the
strictly weaker but fully rational bound a < 137/250. -/
theorem nitsche_a_rational_envelope
    {a : ℝ} (ha : 0 ≤ a)
    (ha2 : a ^ 2 < ((137 / 250 : ℝ) ^ 2)) :
    a < (137 / 250 : ℝ) := by
  nlinarith

/-- Consequent rational coercivity floor alpha > 113/250 = 0.452. -/
theorem nitsche_alpha_floor
    {a : ℝ} (ha : a < (137 / 250 : ℝ)) :
    (113 / 250 : ℝ) < 1 - a := by
  nlinarith

/-- Consequent rational continuity ceiling M < 387/250 = 1.548. -/
theorem nitsche_continuity_ceiling
    {a : ℝ} (ha : a < (137 / 250 : ℝ)) :
    1 + a < (387 / 250 : ℝ) := by
  nlinarith

end ZeroGradientLean
