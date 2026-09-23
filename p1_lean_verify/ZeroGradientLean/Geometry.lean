import Mathlib
noncomputable section
namespace ZeroGradientLean
theorem three_halves_pow_four : ((3 / 2 : ℝ) ^ 4) = 81 / 16 := by norm_num
theorem fourth_order_below_three_halves_order
    {t : ℝ} (ht : 0 ≤ t) (ht5 : t ^ 5 ≤ (16 / 81 : ℝ)) :
    (81 / 16 : ℝ) * t ^ 8 ≤ t ^ 3 := by
  have ht3 : 0 ≤ t ^ 3 := by positivity
  nlinarith [mul_le_mul_of_nonneg_left ht5 ht3]
theorem zra_tight_fourth_order_bridge
    {t hOmega : ℝ} (ht : 0 ≤ t) (ht5 : t ^ 5 ≤ (16 / 81 : ℝ))
    (hgeom : hOmega ^ 4 ≤ (81 / 16 : ℝ) * t ^ 8) :
    hOmega ^ 4 ≤ t ^ 3 := by
  exact le_trans hgeom (fourth_order_below_three_halves_order ht ht5)
theorem sec_envelope_arithmetic :
    (30 : ℚ) * (401408 / 401287 : ℚ) = 12042240 / 401287 := by norm_num
end ZeroGradientLean
