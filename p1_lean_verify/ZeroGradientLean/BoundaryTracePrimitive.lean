import Mathlib

namespace ZeroGradientLean

def edgeBeta (t : ℚ) : ℚ := t ^ 2 * (1 - t) ^ 2

def edgePrimitive (t : ℚ) : ℚ := t ^ 3 / 3 - t ^ 4 / 2 + t ^ 5 / 5

theorem edge_beta_expand (t : ℚ) : edgeBeta t = t ^ 2 - 2 * t ^ 3 + t ^ 4 := by
  unfold edgeBeta
  ring

theorem edge_primitive_endpoints :
    edgePrimitive 0 = 0 ∧ edgePrimitive 1 = 1 / 30 := by
  norm_num [edgePrimitive]

theorem edge_flux_increment (length coeff : ℚ) :
    length * coeff * (edgePrimitive 1 - edgePrimitive 0) = length * coeff / 30 := by
  norm_num [edgePrimitive]
  ring

theorem edge_weighted_pairing_ratio (length coeff : ℚ) :
    length * coeff ^ 2 / 30 = 21 * (length * coeff ^ 2 / 630) := by
  ring

end ZeroGradientLean
