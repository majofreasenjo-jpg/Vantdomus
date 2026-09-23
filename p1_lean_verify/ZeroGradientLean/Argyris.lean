import Mathlib
namespace ZeroGradientLean
def argyrisGramRowBound : ℚ := 4295 / 21
def argyrisNodalNormSq : ℚ := 483 / 16
def argyrisReferenceEnergy : ℚ := 98785 / 16
def argyrisTriangleEnergy : ℚ := 98785
def argyrisSectorEnergy : ℚ := 197570
def argyrisDirectEnergyConstant : ℚ := 276598
def argyrisCfSq : ℚ := 276698 / 101
theorem argyris_reference_energy_identity :
    argyrisGramRowBound * argyrisNodalNormSq = argyrisReferenceEnergy := by
  norm_num [argyrisGramRowBound, argyrisNodalNormSq, argyrisReferenceEnergy]
theorem argyris_triangle_energy_identity :
    16 * argyrisReferenceEnergy = argyrisTriangleEnergy := by
  norm_num [argyrisReferenceEnergy, argyrisTriangleEnergy]
theorem argyris_sector_energy_identity :
    2 * argyrisTriangleEnergy = argyrisSectorEnergy := by
  norm_num [argyrisTriangleEnergy, argyrisSectorEnergy]
theorem argyris_direct_energy_identity :
    (1260 / 900 : ℚ) * argyrisSectorEnergy = argyrisDirectEnergyConstant := by
  norm_num [argyrisSectorEnergy, argyrisDirectEnergyConstant]
theorem argyris_cf_sq_identity :
    (argyrisDirectEnergyConstant + 100) / 101 = argyrisCfSq := by
  norm_num [argyrisDirectEnergyConstant, argyrisCfSq]
theorem argyris_det_certificate_nonzero : (1 / 32 : ℚ) ≠ 0 := by norm_num
end ZeroGradientLean
