import Mathlib

noncomputable section

namespace ZeroGradientLean

/-- Exact fourth power of the ZR-A-tight global/local mesh ratio ceiling. -/
theorem three_halves_pow_four : ((3 / 2 : ℝ) ^ 4) = 81 / 16 := by
  norm_num

/-- Polynomial form of the geometric comparison used in the final rate
contradiction.  We write `hGamma = t^2`, so `hGamma^(3/2)=t^3` and
`hGamma^4=t^8`. -/
theorem fourth_order_below_three_halves_order
    {t : ℝ} (ht : 0 ≤ t) (ht5 : t ^ 5 ≤ (16 / 81 : ℝ)) :
    (81 / 16 : ℝ) * t ^ 8 ≤ t ^ 3 := by
  have ht3 : 0 ≤ t ^ 3 := by positivity
  nlinarith [mul_le_mul_of_nonneg_left ht5 ht3]

/-- Once the mesh-generation layer supplies
`hOmega^4 ≤ (81/16) t^8`, the ZR-A-tight geometry implies the required
`hOmega^4 ≤ t^3` comparison. -/
theorem zra_tight_fourth_order_bridge
    {t hOmega : ℝ}
    (ht : 0 ≤ t)
    (ht5 : t ^ 5 ≤ (16 / 81 : ℝ))
    (hgeom : hOmega ^ 4 ≤ (81 / 16 : ℝ) * t ^ 8) :
    hOmega ^ 4 ≤ t ^ 3 := by
  exact le_trans hgeom (fourth_order_below_three_halves_order ht ht5)

/-- Rational enclosure used after the exact identity
`h_perp = hGamma * cos(pi/N)` has been established geometrically. -/
theorem sec_envelope_arithmetic :
    (30 : ℚ) * (401408 / 401287 : ℚ) = 12042240 / 401287 := by
  norm_num

end ZeroGradientLean
