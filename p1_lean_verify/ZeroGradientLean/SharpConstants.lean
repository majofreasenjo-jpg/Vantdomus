import Mathlib
import ZeroGradientLean.TraceP3
import ZeroGradientLean.MainTheorem

noncomputable section

namespace ZeroGradientLean

def gStar : ℝ := 0.0705914396

def residualSharp : ℝ :=
  0.0028181773716792577886826718492807433953672794434469706827800053706446640921360633

def aSharp : ℝ := 0.547805128625438971623309157

def mSharp : ℝ := 1.547805128625438971623309157

def velocitySharp : ℝ := 0.00182075722554427747183594

theorem gStar_pos : 0 < gStar := by
  norm_num [gStar]

theorem residualSharp_pos : 0 < residualSharp := by
  norm_num [residualSharp]

theorem aSharp_pos : 0 < aSharp := by
  norm_num [aSharp]

theorem velocitySharp_pos : 0 < velocitySharp := by
  norm_num [velocitySharp]

theorem residualSharp_sq_certificate :
    residualSharp ^ 2 * 276698 < (21 * gStar) ^ 2 := by
  norm_num [residualSharp, gStar]

theorem residualSharp_times_sqrt_lt :
    residualSharp * Real.sqrt 276698 < 21 * gStar := by
  have hs0 : 0 ≤ Real.sqrt (276698 : ℝ) := Real.sqrt_nonneg _
  have hs2 : (Real.sqrt (276698 : ℝ)) ^ 2 = 276698 := by
    norm_num
  have hr0 : 0 < residualSharp := residualSharp_pos
  have hg0 : 0 < 21 * gStar := by
    norm_num [gStar]
  have hsq := residualSharp_sq_certificate
  nlinarith

theorem residualSharp_below_exact_formula :
    residualSharp < 21 * gStar / Real.sqrt 276698 := by
  have hs : 0 < Real.sqrt (276698 : ℝ) := Real.sqrt_pos.2 (by norm_num)
  rw [lt_div_iff₀ hs]
  exact residualSharp_times_sqrt_lt

theorem aSharp_sq_certificate :
    cGammaSqRationalUpper / 100 < aSharp ^ 2 := by
  norm_num [cGammaSqRationalUpper, aSharp]

theorem nitsche_a_sharp :
    Real.sqrt ((cGammaSqRationalUpper : ℝ) / 100) < aSharp := by
  have hx0 : 0 ≤ (cGammaSqRationalUpper : ℝ) / 100 := by
    norm_num [cGammaSqRationalUpper]
  have hs0 := Real.sqrt_nonneg ((cGammaSqRationalUpper : ℝ) / 100)
  have hs2 : (Real.sqrt ((cGammaSqRationalUpper : ℝ) / 100)) ^ 2 =
      (cGammaSqRationalUpper : ℝ) / 100 := by
    simpa using Real.sq_sqrt hx0
  have ha0 : 0 < aSharp := aSharp_pos
  have hsq := aSharp_sq_certificate
  nlinarith

theorem mSharp_identity : mSharp = 1 + aSharp := by
  norm_num [mSharp, aSharp]

theorem nitsche_continuity_sharp :
    1 + Real.sqrt ((cGammaSqRationalUpper : ℝ) / 100) < mSharp := by
  rw [mSharp_identity]
  linarith [nitsche_a_sharp]

theorem velocity_product_certificate :
    velocitySharp * mSharp < residualSharp := by
  norm_num [velocitySharp, mSharp, residualSharp]

theorem sharp_residual_forces_velocity
    {h r u : ℝ}
    (hh : 0 ≤ h)
    (hu : 0 ≤ u)
    (hr : residualSharp * Real.sqrt h ≤ r)
    (hru : r ≤
      (1 + Real.sqrt ((cGammaSqRationalUpper : ℝ) / 100)) * u) :
    velocitySharp * Real.sqrt h ≤ u := by
  have hs0 : 0 ≤ Real.sqrt h := Real.sqrt_nonneg h
  have hM :
      (1 + Real.sqrt ((cGammaSqRationalUpper : ℝ) / 100)) * u
        ≤ mSharp * u := by
    have hm := nitsche_continuity_sharp
    exact mul_le_mul_of_nonneg_right (le_of_lt hm) hu
  have hru' : r ≤ mSharp * u := le_trans hru hM
  have hp := velocity_product_certificate
  have hcoef : velocitySharp * mSharp ≤ residualSharp := le_of_lt hp
  have hleft :
      (velocitySharp * mSharp) * Real.sqrt h
        ≤ residualSharp * Real.sqrt h :=
    mul_le_mul_of_nonneg_right hcoef hs0
  have hchain :
      (velocitySharp * mSharp) * Real.sqrt h ≤ mSharp * u :=
    le_trans hleft (le_trans hr hru')
  have hmpos : 0 < mSharp := by norm_num [mSharp]
  have hchain' :
      mSharp * (velocitySharp * Real.sqrt h) ≤ mSharp * u := by
    nlinarith
  exact (mul_le_mul_left hmpos).mp hchain'

theorem sharp_no_universal_h32_rate
    {C t : ℝ} (hC : 0 < C) (ht : 0 < t)
    (ht2 : t ^ 2 < velocitySharp / (2 * C)) :
    ¬ (velocitySharp * t ≤ 2 * C * t ^ 3) := by
  exact sqrt_vs_three_halves_contradiction
    (c := velocitySharp) (C := C) (t := t)
    velocitySharp_pos hC ht ht2

end ZeroGradientLean
