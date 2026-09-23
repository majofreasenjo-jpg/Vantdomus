import Mathlib
import ZeroGradientLean.Geometry
import ZeroGradientLean.Argyris
import ZeroGradientLean.Nitsche
noncomputable section
namespace ZeroGradientLean
def residualFloor : ℝ := 1409/500000
def velocityFloor : ℝ := 91/50000
theorem residual_forces_velocity
    {h r u : ℝ} (hh : 0 ≤ h)
    (hr : residualFloor * Real.sqrt h ≤ r)
    (hru : r ≤ (387/250:ℝ)*u) :
    velocityFloor * Real.sqrt h ≤ u := by
  have hs : 0 ≤ Real.sqrt h := Real.sqrt_nonneg h
  have hcoef : velocityFloor*(387/250:ℝ) < residualFloor := by
    norm_num [velocityFloor,residualFloor]
  nlinarith
theorem sqrt_vs_three_halves_contradiction
    {c C t : ℝ} (hc : 0<c) (hC : 0<C) (ht : 0<t)
    (ht2 : t^2 < c/(2*C)) :
    ¬ (c*t ≤ 2*C*t^3) := by
  intro hbad
  have h2C : 0 < 2*C := by positivity
  have hscaled : 2*C*t^2 < c := by
    apply (lt_div_iff₀ h2C).mp at ht2
    nlinarith
  nlinarith [mul_lt_mul_of_pos_right hscaled ht]
theorem no_universal_h32_rate_at_small_scale
    {C t : ℝ} (hC : 0<C) (ht : 0<t)
    (ht2 : t^2 < velocityFloor/(2*C)) :
    ¬ (velocityFloor*t ≤ 2*C*t^3) := by
  exact sqrt_vs_three_halves_contradiction
    (c:=velocityFloor) (C:=C) (t:=t)
    (by norm_num [velocityFloor]) hC ht ht2
end ZeroGradientLean
