import Mathlib

/-!
P1 FA3: exact weighted P3 trace certificate.
This is a separate candidate module. Its proof does not assume the
unformalized finite-element geometry, witness, or trace-slicing bridge.
-/

namespace ZeroGradientLean

noncomputable section

def p3WeightedEnergy (a b c d : ℝ) : ℝ :=
  a ^ 2 / 2 + a * b / 3 + a * c / 6 + a * d / 10 +
  b ^ 2 / 12 + b * c / 10 + b * d / 15 +
  c ^ 2 / 30 + c * d / 21 + d ^ 2 / 56

theorem p3_weighted_trace_sos (a b c d : ℝ) :
    20 * p3WeightedEnergy a b c d - a ^ 2 =
      9 * (a + (10 / 27 : ℝ) * b + (5 / 27 : ℝ) * c + d / 9) ^ 2 +
      (35 / 81 : ℝ) * (b + (31 / 35 : ℝ) * c + (24 / 35 : ℝ) * d) ^ 2 +
      (2 / 105 : ℝ) * (c + (3 / 2 : ℝ) * d) ^ 2 := by
  unfold p3WeightedEnergy
  ring

theorem p3_weighted_trace_bound (a b c d : ℝ) :
    a ^ 2 ≤ 20 * p3WeightedEnergy a b c d := by
  have hs := p3_weighted_trace_sos a b c d
  have hp : 0 ≤ 20 * p3WeightedEnergy a b c d - a ^ 2 := by
    rw [hs]
    positivity
  linarith

theorem p3_riesz_kernel_four_moments :
    ((20 : ℚ) / 2 - 180 / 6 + 420 / 12 - 280 / 20 = 1) ∧
    ((20 : ℚ) / 6 - 180 / 12 + 420 / 20 - 280 / 30 = 0) ∧
    ((20 : ℚ) / 12 - 180 / 20 + 420 / 30 - 280 / 42 = 0) ∧
    ((20 : ℚ) / 20 - 180 / 30 + 420 / 42 - 280 / 56 = 0) := by
  norm_num

theorem p3_weighted_trace_sharp :
    20 * p3WeightedEnergy 20 (-180) 420 (-280) = (20 : ℝ) ^ 2 := by
  norm_num [p3WeightedEnergy]

end ZeroGradientLean
