import Mathlib

/-!
P1 FA10: local Argyris rotated-gradient polynomial certificate.
Exact polynomial identity, uniform in all streamfunction coefficients.
This DOES NOT certify global C¹ assembly, boundary conditions, Scott–Vogelius
membership, the FEM witness, or the forcing/residual lower bound.
-/

namespace ZeroGradientLean

open MvPolynomial

abbrev ArgyrisPoly2 := MvPolynomial (Fin 2) ℚ

noncomputable def argyrisCurlX (ψ : ArgyrisPoly2) : ArgyrisPoly2 :=
  (pderiv (1 : Fin 2)) ψ

noncomputable def argyrisCurlY (ψ : ArgyrisPoly2) : ArgyrisPoly2 :=
  -((pderiv (0 : Fin 2)) ψ)

noncomputable def argyrisPolyDivergence (vx vy : ArgyrisPoly2) : ArgyrisPoly2 :=
  (pderiv (0 : Fin 2)) vx + (pderiv (1 : Fin 2)) vy

/-- Lean v4.24 does not provide the later Mathlib `pderiv_comm` lemma.
    We prove commutation from polynomial induction and the Leibniz rule. -/
private theorem argyris_pderiv_comm (i j : Fin 2) (p : ArgyrisPoly2) :
    (pderiv i) ((pderiv j) p) = (pderiv j) ((pderiv i) p) := by
  classical
  induction p using MvPolynomial.induction_on with
  | C a => simp
  | add p q hp hq => simp [hp, hq]
  | mul_X p a h =>
    simp only [pderiv_mul, map_add, pderiv_X, Pi.single_apply, h]
    split_ifs <;> simp [add_right_comm]

theorem argyris_local_curl_divergence_zero (ψ : ArgyrisPoly2) :
    argyrisPolyDivergence (argyrisCurlX ψ) (argyrisCurlY ψ) = 0 := by
  unfold argyrisPolyDivergence argyrisCurlX argyrisCurlY
  rw [map_neg, argyris_pderiv_comm (0 : Fin 2) (1 : Fin 2) ψ]
  exact add_neg_cancel_self _

/-- A rotated gradient's normal trace along a straight edge is minus
the tangential derivative of the streamfunction. -/
theorem curl_normal_equals_negative_tangential
    (dx dy tx ty : ℚ) :
    dy * (-ty) + (-dx) * tx = -(dx * tx + dy * ty) := by
  ring

/-- Thus a tangentially constant boundary streamfunction induces
zero normal velocity, pointwise on each straight edge. -/
theorem curl_zero_normal_of_zero_tangential
    (dx dy tx ty : ℚ) (h : dx * tx + dy * ty = 0) :
    dy * (-ty) + (-dx) * tx = 0 := by
  rw [curl_normal_equals_negative_tangential, h]
  ring

end ZeroGradientLean
