import ZeroGradientLean.MainTheorem

/-! P1 FA7: sharpen the selected-core scalar response consequence exactly.
This module proves only a conditional arithmetic bridge. It does not assert
that the FEM residual hypotheses have been constructed or verified. -/

namespace ZeroGradientLean

def exactVelocityFloorRational : ℚ := 1409 / 774000

theorem exact_velocity_floor_arithmetic :
    (1409 / 500000 : ℚ) =
      (387 / 250 : ℚ) * exactVelocityFloorRational := by
  norm_num [exactVelocityFloorRational]

theorem selected_velocity_floor_strict_slack :
    exactVelocityFloorRational - (91 / 50000 : ℚ) = 1 / 2418750 := by
  norm_num [exactVelocityFloorRational]

theorem residual_implies_exact_response
    {h r u : ℝ}
    (hr : residualFloor * Real.sqrt h ≤ r)
    (hru : r ≤ (387 / 250 : ℝ) * u) :
    (1409 / 774000 : ℝ) * Real.sqrt h ≤ u := by
  dsimp [residualFloor] at hr
  nlinarith [hr, hru]

end ZeroGradientLean
