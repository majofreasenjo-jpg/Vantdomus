import Mathlib

namespace ZeroGradientLean

/-- Exact finite-dimensional constants reproduced by the companion rational
certificate.  This Lean layer verifies the arithmetic chain consuming that
certificate.  The matrix-generation replay remains separately hashed. -/
def argyrisGramRowBound : ℚ := 4295 / 21
def argyrisNodalNormSq : ℚ := 483 / 16
def argyrisReferenceEnergy : ℚ := 98785 / 16
def argyrisTriangleEnergy : ℚ := 98785
def argyrisSectorEnergy : ℚ := 197570
def argyrisDirectEnergyConstant : ℚ := 276598
def argyrisCfSq : ℚ := 276698 / 101

/-- The rational reference-energy multiplication is exact. -/
theorem argyris_reference_energy_identity :
    argyrisGramRowBound * argyrisNodalNormSq = argyrisReferenceEnergy := by
  norm_num [argyrisGramRowBound, argyrisNodalNormSq, argyrisReferenceEnergy]

/-- The affine pullback factor 16 converts the reference bound to the certified
single-triangle bound. -/
theorem argyris_triangle_energy_identity :
    16 * argyrisReferenceEnergy = argyrisTriangleEnergy := by
  norm_num [argyrisReferenceEnergy, argyrisTriangleEnergy]

/-- Two boundary triangles per polygon sector. -/
theorem argyris_sector_energy_identity :
    2 * argyrisTriangleEnergy = argyrisSectorEnergy := by
  norm_num [argyrisTriangleEnergy, argyrisSectorEnergy]

/-- Conversion from sector energy to the uniform direct-lift coefficient. -/
theorem argyris_direct_energy_identity :
    (1260 / 900 : ℚ) * argyrisSectorEnergy = argyrisDirectEnergyConstant := by
  norm_num [argyrisSectorEnergy, argyrisDirectEnergyConstant]

/-- Penalty mu=100 gives the exact certified `C_F^2` arithmetic. -/
theorem argyris_cf_sq_identity :
    (argyrisDirectEnergyConstant + 100) / 101 = argyrisCfSq := by
  norm_num [argyrisDirectEnergyConstant, argyrisCfSq]

/-- The standard Argyris interpolation replay reports determinant magnitude
`1/32`.  This theorem records its non-vanishing consequence used downstream. -/
theorem argyris_det_certificate_nonzero : (1 / 32 : ℚ) ≠ 0 := by
  norm_num

end ZeroGradientLean
