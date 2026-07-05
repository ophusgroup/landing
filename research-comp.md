---
title: Computational Imaging and Open Software
description: Reconstruction algorithms, physics-guided machine learning, and open-source packages for quantitative microscopy.
---

:::{anywidget} https://cdn.jsdelivr.net/gh/ophusgroup/landing@main/widgets/section-nav.js
{}
:::

[← Back to Research](/research)

We build reconstruction algorithms, simulations, and open-source software for quantitative microscopy. Our methods include ptychography, tomography, and physics-guided machine learning to convert raw high-dimensional data into interpretable structure.

## Deep-Prior Electron Ptychography

Deep generative priors make electron ptychography more robust to low dose, noise, and incomplete experimental knowledge. Neural parameterizations of the sample and probe improve phase retrieval while reducing manual tuning and reconstruction artifacts.

[Deep generative priors for electron ptychography](https://arxiv.org/abs/2511.07795)

## Electron Tomography with Implicit Neural Representations

Implicit neural representations provide a self-supervised route to electron tomography from limited and misaligned projection data. A continuous neural representation of the object enables joint reconstruction, alignment refinement, denoising, and missing-wedge compensation.

[Missing-wedge inpainting and joint alignment with INRs](https://arxiv.org/abs/2512.08113)

## Atomic Electron Tomography

Atomic electron tomography (AET) determines the three-dimensional positions and chemical species of individual atoms by recording atomic-resolution images across many tilt angles and reconstructing the volume. Our group pioneered ptychographic AET (PAET), which couples ptychographic phase retrieval to tomography to reach light elements and complex nanostructures that conventional methods cannot resolve.

::::{div}
<div style="width: 75%; margin: 1em auto;"><img src="/images/research/figure_AET_ZrTe_DWCNT.jpg" style="width: 100%;" alt="A ZrTe nanowire encapsulated in a double-walled carbon nanotube, solved with ptychographic AET." /><p style="font-size: 0.88em; opacity: 0.72; margin: 0.5em 0 0; text-align: center;">A ZrTe nanowire encapsulated in a double-walled carbon nanotube, solved with ptychographic AET.</p></div>
::::

[Solving complex nanostructures with PAET](doi.org/10.1038/s41467-023-43634-z), [3D positions of individual atoms revealed by electron tomography](doi.org/10.1038/nmat4426)

## 4D-STEM Analysis Software with quantEM and py4DSTEM

::::{div}
<div style="width: 26%; float: right; margin-left: 1em;"><img src="/images/research/quantem_py4dstem_logos.png" alt="quantEM and py4DSTEM" style="width: 100%;" /></div>

quantEM and py4DSTEM are our open-source Python packages for quantitative 4D-STEM. They cover calibration, visualization, diffraction analysis, strain and orientation mapping, phase retrieval, ptychography, and simulation, with scalable workflows built for the high-dimensional datasets that modern detectors produce. Both are open and reproducible, so analysis pipelines can be shared, audited, and reused across groups.

[quantEM code](https://github.com/ophusgroup/quantem), [py4DSTEM code](https://github.com/py4dstem/py4DSTEM), [py4DSTEM: multimodal 4D-STEM data analysis](doi.org/10.1017/S1431927621000477)
::::

## Scanning Probe Drift Correction

Sequential scanning makes STEM and SPM images vulnerable to drift, scan distortion, and beam-induced motion. Orthogonal scan pairs provide accurate fast-scan information in different directions, allowing nonlinear drift correction and recovery of undistorted sample coordinates.

[Correcting nonlinear drift distortion from orthogonal scan pairs](doi.org/10.1016/j.ultramic.2015.12.002), [drift-correction code](https://github.com/cophus/scanning-drift-corr)

## Quantum Mechanical Electron-Scattering Simulations

Fast electron-scattering simulations connect atomic models, microscope settings, and measured images or diffraction patterns. PRISM and Prismatic accelerate multislice-based STEM simulations by orders of magnitude, enabling experiment design, algorithm testing, and interpretation of large datasets.

[PRISM fast STEM image simulations](doi.org/10.1186/s40679-017-0046-1), [Prismatic multi-GPU STEM simulations](doi.org/10.1186/s40679-017-0048-z), [Prismatic documentation](https://prism-em.github.io/)
