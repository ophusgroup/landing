---
title: Research Projects
description: Research across scanning transmission electron microscopy, computational imaging and open-source software, and atomic-scale materials structure.
---

:::{anywidget} https://cdn.jsdelivr.net/gh/ophusgroup/landing@d7c89f4/widgets/section-nav.js
{}
:::

We develop new scanning transmission electron microscopy (STEM) experiments, reconstruction and machine learning algorithms, and open-source software. These tools let us image and understand materials atom by atom. Our research spans three areas:

:::{anywidget} https://cdn.jsdelivr.net/gh/ophusgroup/landing@main/widgets/research-pillars.js
{}
:::



## Scanning Transmission Electron Microscopy

### Nanobeam 4D-STEM of Ordered Materials

Crystalline materials diffract electrons into sharp Bragg peaks that encode local orientation, phase, and strain. Nanobeam 4D-STEM indexes a full diffraction pattern at every probe position, mapping grains, domains, twins, and interfaces across heterogeneous polycrystalline samples with nanometer resolution.

[diffraction pattern indexing for orientation and phase mapping](doi.org/10.1017/S1431927622000101), [strain mapping](doi.org/10.1016/j.ultramic.2016.12.021)

### Nanobeam 4D-STEM of Disordered Materials

::::{div}
<div style="width: 32%; float: right; margin-left: 1em;"><video src="/videos/atomic_struct_04_crop.mp4" autoplay loop muted playsinline style="width: 100%;"></video></div>

Nanobeam diffraction reveals short- and medium-range order in materials that are neither fully crystalline nor fully amorphous. The `tricor` framework generates disordered atomic models from three-body correlations, enabling direct comparison between simulated structures and experimental diffraction.

[tricor: disordered-structure simulations](https://tricor.readthedocs.io/en/latest/)
::::

### Nanobeam Diffraction and Machine Learning for Polymer Order

Low-dose nanobeam electron diffraction combined with machine learning maps semicrystalline order in polymer materials. The resulting structural maps quantify orientation, morphology, and local ordering across noisy and heterogeneous polymer microstructures.

### Topography and Strain Mapping of 2D Membranes

Rippled and suspended membranes require strain analysis on the actual curved surface, not on a flat projection. Nanobeam 4D-STEM measurements reconstruct both out-of-plane topography and in-plane strain, enabling quantitative maps of deformed two-dimensional materials.

[Strain mapping of 3D-structured 2D materials](doi.org/10.1126/sciadv.adz7908)

### In Situ 4D-STEM and 5D-STEM

Scanning diffraction can track structural changes during dynamic experiments, but in situ 4D-STEM datasets are often too large and complex to analyze manually. Unsupervised clustering of diffraction-pattern similarity segments coherent structural regions, compresses massive datasets, and quantifies liquid-cell growth pathways.

[Unsupervised clustering for 4D-STEM and 5D-STEM](https://arxiv.org/abs/2601.17262), [segmentation and clustering workflow](doi.org/10.1093/mam/ozag044)

### 4D-STEM of CO₂ Capture and Utilization in Metal-Organic Frameworks

4D-STEM provides a direct view of structural heterogeneity in metal-organic frameworks designed for integrated CO₂ capture and conversion. This project connects local framework order, pore-scale structure, and reaction-driven changes to capture and utilization performance.


## Computational Imaging and Open Software

### Deep-Prior Electron Ptychography

Deep generative priors make electron ptychography more robust to low dose, noise, and incomplete experimental knowledge. Neural parameterizations of the sample and probe improve phase retrieval while reducing manual tuning and reconstruction artifacts.

[Deep generative priors for electron ptychography](https://arxiv.org/abs/2511.07795)

### Electron Tomography with Implicit Neural Representations

Implicit neural representations provide a self-supervised route to electron tomography from limited and misaligned projection data. A continuous neural representation of the object enables joint reconstruction, alignment refinement, denoising, and missing-wedge compensation.

[Missing-wedge inpainting and joint alignment with INRs](https://arxiv.org/abs/2512.08113)

### Atomic Electron Tomography

Atomic electron tomography (AET) determines the three-dimensional positions and chemical species of individual atoms by recording atomic-resolution images across many tilt angles and reconstructing the volume. Our group pioneered ptychographic AET (PAET), which couples ptychographic phase retrieval to tomography to reach light elements and complex nanostructures that conventional methods cannot resolve.

::::{div}
<div style="width: 75%; margin: 1em auto;"><img src="/images/research/figure_AET_ZrTe_DWCNT.jpg" style="width: 100%;" alt="A ZrTe nanowire encapsulated in a double-walled carbon nanotube, solved with ptychographic AET." /><p style="font-size: 0.88em; opacity: 0.72; margin: 0.5em 0 0; text-align: center;">A ZrTe nanowire encapsulated in a double-walled carbon nanotube, solved with ptychographic AET.</p></div>
::::

[Solving complex nanostructures with PAET](doi.org/10.1038/s41467-023-43634-z), [3D positions of individual atoms revealed by electron tomography](doi.org/10.1038/nmat4426)

### 4D-STEM Analysis Software with quantEM and py4DSTEM

::::{div}
<div style="width: 26%; float: right; margin-left: 1em;"><img src="/images/research/quantem_py4dstem_logos.png" alt="quantEM and py4DSTEM" style="width: 100%;" /></div>

quantEM and py4DSTEM are our open-source Python packages for quantitative 4D-STEM. They cover calibration, visualization, diffraction analysis, strain and orientation mapping, phase retrieval, ptychography, and simulation, with scalable workflows built for the high-dimensional datasets that modern detectors produce. Both are open and reproducible, so analysis pipelines can be shared, audited, and reused across groups.

[quantEM code](https://github.com/ophusgroup/quantem), [py4DSTEM code](https://github.com/py4dstem/py4DSTEM), [py4DSTEM: multimodal 4D-STEM data analysis](doi.org/10.1017/S1431927621000477)
::::

### Scanning Probe Drift Correction

Sequential scanning makes STEM and SPM images vulnerable to drift, scan distortion, and beam-induced motion. Orthogonal scan pairs provide accurate fast-scan information in different directions, allowing nonlinear drift correction and recovery of undistorted sample coordinates.

[Correcting nonlinear drift distortion from orthogonal scan pairs](doi.org/10.1016/j.ultramic.2015.12.002), [drift-correction code](https://github.com/cophus/scanning-drift-corr)

### Quantum Mechanical Electron-Scattering Simulations

Fast electron-scattering simulations connect atomic models, microscope settings, and measured images or diffraction patterns. PRISM and Prismatic accelerate multislice-based STEM simulations by orders of magnitude, enabling experiment design, algorithm testing, and interpretation of large datasets.

[PRISM fast STEM image simulations](doi.org/10.1186/s40679-017-0046-1), [Prismatic multi-GPU STEM simulations](doi.org/10.1186/s40679-017-0048-z), [Prismatic documentation](https://prism-em.github.io/)


## Characterizing Materials on the Atomic Scale

### Imaging, Ptychography, and Tomography of Battery Materials

Advanced electron microscopy reveals how battery materials evolve, degrade, and fail across length scales. Operando imaging, atomic-resolution STEM, ptychography, and tomography connect electrodeposition, defects, and structural evolution to battery performance and lifetime.

[Visualizing degradation in anode-free aqueous batteries](https://arxiv.org/abs/2605.26727)

### In Situ Electron Microscopy of Catalysis

Catalytic function depends on local structure, composition, and interfaces under reaction conditions. In situ microscopy and spectroscopy of plasmonic AuPd/TiO₂ photocatalysts link alloy structure, interfacial adsorbates, and light-driven carrier dynamics to selective chemical conversion.

[Plasmonic photocatalysis of methane with nitrous oxide](https://arxiv.org/abs/2604.18417)

### Atomic-Scale Structure of Functional Materials

Quantitative STEM, ptychography, tomography, diffraction, and spectroscopy map the local structures that control material behavior. Current targets include strain, defects, interfaces, chemical and structural order/disorder, local symmetry, and evolving atomic environments in energy, electronic, quantum, and structural materials.

:::{figure} /images/research/AET_FePt_v01.jpg
:width: 100%
Atomic electron tomography reconstruction of an FePt nanoparticle.
:::
