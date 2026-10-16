import ZeroGradientLean.TraceP3MomentCertificate

/-! P1 FA4 candidate. Algebraic slice and Jacobian only.
The full integral trace bridge and finite-element witness are NOT formally
certified by this module. New Lean kernel compilation remains pending. -/

namespace ZeroGradientLean

def p3Poly (c : Fin 10 → ℝ) (x y : ℝ) : ℝ :=
  c 0 + c 1 * y + c 2 * x + c 3 * y^2 + c 4 * x*y +
  c 5 * x^2 + c 6 * y^3 + c 7 * x*y^2 +
  c 8 * x^2*y + c 9 * x^3

def p3Slice0 (c : Fin 10 → ℝ) (s : ℝ) : ℝ :=
  c 0 + c 2*s + c 5*s^2 + c 9*s^3

def p3Slice1 (c : Fin 10 → ℝ) (s : ℝ) : ℝ :=
  c 1 - c 2*s + c 4*s - 2*c 5*s^2 + c 8*s^2 - 3*c 9*s^3

def p3Slice2 (c : Fin 10 → ℝ) (s : ℝ) : ℝ :=
  c 3 - c 4*s + c 5*s^2 + c 7*s - 2*c 8*s^2 + 3*c 9*s^3

def p3Slice3 (c : Fin 10 → ℝ) (s : ℝ) : ℝ :=
  c 6 - c 7*s + c 8*s^2 - c 9*s^3

theorem p3_affine_reference_slice (c : Fin 10 → ℝ) (s t : ℝ) :
    p3Poly c ((1-t)*s) t =
      p3Slice0 c s + p3Slice1 c s*t +
      p3Slice2 c s*t^2 + p3Slice3 c s*t^3 := by
  dsimp [p3Poly, p3Slice0, p3Slice1, p3Slice2, p3Slice3]
  ring

theorem p3_slice_endpoint (c : Fin 10 → ℝ) (s : ℝ) :
    p3Poly c s 0 = p3Slice0 c s := by
  dsimp [p3Poly,p3Slice0]
  ring

theorem p3_slice_trace_moment_bound (c : Fin 10 → ℝ) (s : ℝ) :
    (p3Poly c s 0)^2 ≤
      20 * p3WeightedEnergy (p3Slice0 c s) (p3Slice1 c s)
           (p3Slice2 c s) (p3Slice3 c s) := by
  rw [p3_slice_endpoint]
  exact p3_weighted_trace_bound _ _ _ _

theorem affine_triangle_jacobian (ex ey fx fy s t : ℝ) :
    ((1-t)*ex)*(-s*ey+fy) - ((1-t)*ey)*(-s*ex+fx) =
      (1-t)*(ex*fy-ey*fx) := by
  ring

end ZeroGradientLean
