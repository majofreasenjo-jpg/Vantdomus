import Mathlib

namespace ZeroGradientLean

theorem quintic_two_endpoint_twojet_unique
    (a0 a1 a2 a3 a4 a5 : ℝ)
    (h0 : a0 = 0) (h1 : a1 = 0) (h2 : 2*a2 = 0)
    (h3 : a0+a1+a2+a3+a4+a5 = 0)
    (h4 : a1+2*a2+3*a3+4*a4+5*a5 = 0)
    (h5 : 2*a2+6*a3+12*a4+20*a5 = 0) :
    a0 = 0 ∧ a1 = 0 ∧ a2 = 0 ∧ a3 = 0 ∧ a4 = 0 ∧ a5 = 0 := by
  constructor
  · exact h0
  constructor
  · exact h1
  have ha2 : a2 = 0 := by linarith
  constructor
  · exact ha2
  have ha3 : a3 = 0 := by linarith
  constructor
  · exact ha3
  have ha4 : a4 = 0 := by linarith
  constructor
  · exact ha4
  · linarith

theorem quartic_endpoint_onejet_midpoint_unique
    (b0 b1 b2 b3 b4 : ℝ)
    (h0 : b0 = 0) (h1 : b1 = 0)
    (h2 : b0+b1+b2+b3+b4 = 0)
    (h3 : b1+2*b2+3*b3+4*b4 = 0)
    (hm : b0 + b1/2 + b2/4 + b3/8 + b4/16 = 0) :
    b0 = 0 ∧ b1 = 0 ∧ b2 = 0 ∧ b3 = 0 ∧ b4 = 0 := by
  constructor
  · exact h0
  constructor
  · exact h1
  have hb2 : b2 = 0 := by linarith
  constructor
  · exact hb2
  have hb3 : b3 = 0 := by linarith
  constructor
  · exact hb3
  · linarith

theorem argyris_shared_edge_c1_algebra
    (a0 a1 a2 a3 a4 a5 b0 b1 b2 b3 b4 : ℝ)
    (ha0 : a0 = 0) (ha1 : a1 = 0) (ha2 : 2*a2 = 0)
    (ha3 : a0+a1+a2+a3+a4+a5 = 0)
    (ha4 : a1+2*a2+3*a3+4*a4+5*a5 = 0)
    (ha5 : 2*a2+6*a3+12*a4+20*a5 = 0)
    (hb0 : b0 = 0) (hb1 : b1 = 0)
    (hb2 : b0+b1+b2+b3+b4 = 0)
    (hb3 : b1+2*b2+3*b3+4*b4 = 0)
    (hbm : b0+b1/2+b2/4+b3/8+b4/16 = 0) :
    (a0=0 ∧ a1=0 ∧ a2=0 ∧ a3=0 ∧ a4=0 ∧ a5=0) ∧
    (b0=0 ∧ b1=0 ∧ b2=0 ∧ b3=0 ∧ b4=0) := by
  exact ⟨quintic_two_endpoint_twojet_unique a0 a1 a2 a3 a4 a5
      ha0 ha1 ha2 ha3 ha4 ha5,
    quartic_endpoint_onejet_midpoint_unique b0 b1 b2 b3 b4
      hb0 hb1 hb2 hb3 hbm⟩

theorem div_rotated_gradient_zero
    (dxy dyx : ℝ) (hmix : dxy = dyx) : dxy - dyx = 0 := by
  linarith

end ZeroGradientLean
