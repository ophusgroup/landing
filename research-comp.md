---
title: Computational Imaging and Open Software
description: Reconstruction algorithms, physics-guided machine learning, and open-source packages for quantitative microscopy.
---

:::{anywidget} https://cdn.jsdelivr.net/gh/ophusgroup/landing@main/widgets/section-nav.js
{}
:::

We build reconstruction algorithms, simulations, and open-source software for quantitative microscopy. Our methods include ptychography, tomography, and physics-guided machine learning to convert raw high-dimensional data into interpretable structure.

## 4D-STEM Analysis Software with quantEM and py4DSTEM

::::{div}
<div style="width: 28%; float: right; margin: 0.3em 0 0.6em 1.2em;"><img src="/images/research/quantem_py4dstem_logos.png" alt="quantEM and py4DSTEM logos" style="width: 100%;" /></div>

[quantEM](https://github.com/ophusgroup/quantem) and [py4DSTEM](https://github.com/py4dstem/py4DSTEM) are our open-source Python packages for quantitative 4D-STEM. They cover calibration, visualization, diffraction analysis, strain and orientation mapping, phase retrieval, ptychography, and simulation, with scalable workflows built for the high-dimensional datasets that modern detectors produce. Both are open and reproducible, so pipelines can be shared, audited, and reused across groups, and the [py4DSTEM methods paper](doi.org/10.1017/S1431927621000477) documents the full analysis toolkit.
::::

## Deep-Prior Electron Ptychography

::::{div}
<div style="width: 44%; float: right; margin: 0.3em 0 0.6em 1.2em;"><img src="/images/research/research_deepprior_ptycho.png" style="width: 100%;" alt="The deep generative prior framework for electron ptychography." /><p style="font-size: 0.85em; opacity: 0.7; margin: 0.4em 0 0; line-height: 1.35;">The deep generative prior framework: neural priors for the probe and object drive multislice ptychography.</p></div>

[Deep generative priors](https://arxiv.org/abs/2511.07795) make electron ptychography more robust to low dose, noise, and incomplete experimental knowledge. Neural parameterizations of the sample and probe improve phase retrieval while reducing manual tuning and reconstruction artifacts.
::::

## Electron Tomography with Implicit Neural Representations

:::{figure} /images/research/research_inr_tomography.png
:alt: The optimization loop of an implicit neural representation for electron tomography.
An implicit neural representation is optimized against the experimental tilt images to reconstruct the volume, jointly refining the object and the projection alignment.
:::

[Implicit neural representations](https://arxiv.org/abs/2512.08113) provide a self-supervised route to electron tomography from limited and misaligned projection data. A continuous neural representation of the object enables joint reconstruction, alignment refinement, denoising, and missing-wedge compensation.

## Atomic Electron Tomography

::::{div}
<div style="width: 42%; float: right; margin: 0.3em 0 0.6em 1.2em;"><img src="/images/research/figure_AET_ZrTe_DWCNT.jpg" style="width: 100%;" alt="A ZrTe nanowire encapsulated in a double-walled carbon nanotube, solved with ptychographic AET." /><p style="font-size: 0.85em; opacity: 0.7; margin: 0.4em 0 0; line-height: 1.35;">A ZrTe nanowire in a double-walled carbon nanotube, solved with ptychographic AET.</p></div>

Atomic electron tomography (AET) determines the three-dimensional positions and chemical species of individual atoms by recording atomic-resolution images across many tilt angles and reconstructing the volume. Our group [pioneered atomic electron tomography](doi.org/10.1038/nmat4426) and developed [ptychographic AET](doi.org/10.1038/s41467-023-43634-z), which couples ptychographic phase retrieval to tomography to reach light elements and complex nanostructures that conventional methods cannot resolve.
::::

## Scanning Probe Drift Correction

:::{figure} /images/research/research_drift_correction.png
:alt: Orthogonal scan pairs enable nonlinear scan-drift correction.
Orthogonal 0° and 90° scans recover the true scan-line origins, correcting nonlinear drift across 2D, 3D, and 4D-STEM data.
:::

Sequential scanning makes STEM and SPM images vulnerable to drift, scan distortion, and beam-induced motion. [Orthogonal scan pairs](doi.org/10.1016/j.ultramic.2015.12.002) provide accurate fast-scan information in different directions, allowing nonlinear drift correction and recovery of undistorted sample coordinates with our [open drift-correction code](https://github.com/cophus/scanning-drift-corr).

## Quantum Mechanical Electron-Scattering Simulations

::::{div}
<div style="width: 44%; float: right; margin: 0.3em 0 0.6em 1.2em;"><img src="/images/research/research_prism_simulation.png" style="width: 100%;" alt="The PRISM algorithm compared with conventional multislice simulation." /><p style="font-size: 0.85em; opacity: 0.7; margin: 0.4em 0 0; line-height: 1.35;">PRISM accelerates multislice STEM simulation by decomposing the scattering into plane waves.</p></div>

Fast electron-scattering simulations connect atomic models, microscope settings, and measured images or diffraction patterns. [PRISM](doi.org/10.1186/s40679-017-0046-1) and [Prismatic](doi.org/10.1186/s40679-017-0048-z) accelerate multislice-based STEM simulations by orders of magnitude. The [open-source Prismatic package](https://prism-em.github.io/) supports experiment design, algorithm testing, and interpretation of large datasets.
::::
