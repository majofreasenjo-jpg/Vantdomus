import Mathlib

/-!
P1 FA12 — explicit nonzero two-triangle quintic streamfunction patch.
The proofs are polynomial identities over rational coefficients.
These lemmas certify a local C1 glued patch with clamped outer boundary.
They do not assert transfer to the ZR-A-tight polygonal annulus or the
Scott–Vogelius/Nitsche residual lower bound.
-/

namespace ZeroGradientLean

def patchPsiLower (x y : ℚ) : ℚ :=
  x^2 * y^2 * (x+y-1)

def patchPsiUpper (x y : ℚ) : ℚ :=
  (1-x)^2 * (1-y)^2 * (x+y-1)

def patchPsiLowerDx (x y : ℚ) : ℚ :=
  2*x*y^2*(x+y-1) + x^2*y^2

def patchPsiLowerDy (x y : ℚ) : ℚ :=
  2*y*x^2*(x+y-1) + x^2*y^2

def patchPsiUpperDx (x y : ℚ) : ℚ :=
  -2*(1-x)*(1-y)^2*(x+y-1) + (1-x)^2*(1-y)^2

def patchPsiUpperDy (x y : ℚ) : ℚ :=
  -2*(1-y)*(1-x)^2*(x+y-1) + (1-x)^2*(1-y)^2

theorem patch_c0_diagonal (x : ℚ) :
    patchPsiLower x (1-x) = patchPsiUpper x (1-x) := by
  dsimp [patchPsiLower, patchPsiUpper]
  ring

theorem patch_c1_dx_diagonal (x : ℚ) :
    patchPsiLowerDx x (1-x) = patchPsiUpperDx x (1-x) := by
  dsimp [patchPsiLowerDx, patchPsiUpperDx]
  ring

theorem patch_c1_dy_diagonal (x : ℚ) :
    patchPsiLowerDy x (1-x) = patchPsiUpperDy x (1-x) := by
  dsimp [patchPsiLowerDy, patchPsiUpperDy]
  ring

theorem patch_clamped_lower_x0 (y : ℚ) :
    patchPsiLower 0 y = 0 ∧ patchPsiLowerDx 0 y = 0 ∧
    patchPsiLowerDy 0 y = 0 := by
  simp [patchPsiLower, patchPsiLowerDx, patchPsiLowerDy]

theorem patch_clamped_lower_y0 (x : ℚ) :
    patchPsiLower x 0 = 0 ∧ patchPsiLowerDx x 0 = 0 ∧
    patchPsiLowerDy x 0 = 0 := by
  simp [patchPsiLower, patchPsiLowerDx, patchPsiLowerDy]

theorem patch_clamped_upper_x1 (y : ℚ) :
    patchPsiUpper 1 y = 0 ∧ patchPsiUpperDx 1 y = 0 ∧
    patchPsiUpperDy 1 y = 0 := by
  simp [patchPsiUpper, patchPsiUpperDx, patchPsiUpperDy]

theorem patch_clamped_upper_y1 (x : ℚ) :
    patchPsiUpper x 1 = 0 ∧ patchPsiUpperDx x 1 = 0 ∧
    patchPsiUpperDy x 1 = 0 := by
  simp [patchPsiUpper, patchPsiUpperDx, patchPsiUpperDy]

theorem patch_nonzero :
    patchPsiLower (1/4) (1/4) = -(1/512 : ℚ) := by
  norm_num [patchPsiLower]

theorem patch_rotated_gradient_nonzero :
    -(patchPsiLowerDx (1/4) (1/4)) = (3/256 : ℚ) := by
  norm_num [patchPsiLowerDx]

/-- The two explicit polynomials have identical mixed formal derivatives. -/
theorem patch_lower_mixed_commute (x y : ℚ) :
    (4*x*y*(x+y-1) + 2*x*y^2 + 2*x^2*y) =
    (4*x*y*(x+y-1) + 2*y*x^2 + 2*x*y^2) := by
  ring

theorem patch_upper_mixed_commute (x y : ℚ) :
    (4*(1-x)*(1-y)*(x+y-1) - 2*(1-x)*(1-y)^2 -
       2*(1-x)^2*(1-y)) =
    (4*(1-x)*(1-y)*(x+y-1) - 2*(1-x)^2*(1-y) -
       2*(1-x)*(1-y)^2) := by
  ring

end ZeroGradientLean
