import Mathlib
import Mathlib.Analysis.SpecialFunctions.Integrals.Basic

noncomputable section

namespace ZeroGradientLean

open intervalIntegral

def beta (t : ℝ) : ℝ := t^2 * (1-t)^2

theorem beta_expand (t : ℝ) :
    beta t = t^2 - 2*t^3 + t^4 := by
  simp [beta]
  ring

theorem beta_sq_expand (t : ℝ) :
    beta t ^ 2 = t^4 - 4*t^5 + 6*t^6 - 4*t^7 + t^8 := by
  simp [beta]
  ring

theorem beta_integral_exact :
    (∫ t : ℝ in 0..1, beta t) = (1/30 : ℝ) := by
  simp_rw [beta_expand]
  norm_num [intervalIntegral.integral_add, intervalIntegral.integral_sub,
    intervalIntegral.integral_const_mul, integral_pow]

theorem beta_sq_integral_exact :
    (∫ t : ℝ in 0..1, beta t ^ 2) = (1/630 : ℝ) := by
  simp_rw [beta_sq_expand]
  norm_num [intervalIntegral.integral_add, intervalIntegral.integral_sub,
    intervalIntegral.integral_const_mul, integral_pow]

theorem local_pressure_moment_factor_21
    (ell m : ℝ) :
    ell * m^2 * (1/30 : ℝ) = 21 * (ell * m^2 * (1/630 : ℝ)) := by
  ring

theorem sum_successive_differences (y : ℕ → ℝ) (N : ℕ) :
    Finset.sum (Finset.range N) (fun j => y (j+1) - y j) = y N - y 0 := by
  induction N with
  | zero => simp
  | succ N ih =>
      rw [Finset.sum_range_succ, ih]
      ring

theorem cyclic_successive_differences_zero
    (y : ℕ → ℝ) (N : ℕ) (hclose : y N = y 0) :
    Finset.sum (Finset.range N) (fun j => y (j+1) - y j) = 0 := by
  rw [sum_successive_differences, hclose]
  ring

theorem polygon_flux_telescopes
    (c : ℝ) (y : ℕ → ℝ) (N : ℕ) (hclose : y N = y 0) :
    Finset.sum (Finset.range N) (fun j => c * (y (j+1) - y j)) = 0 := by
  rw [← Finset.mul_sum]
  rw [cyclic_successive_differences_zero y N hclose]
  ring

end ZeroGradientLean
