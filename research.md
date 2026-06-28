---
title: Research Projects
description: Research in 4DSTEM, atomic electron tomography, STEM probe design, quantum mechanical simulations, and computational materials science.
---

:::{anywidget} https://cdn.jsdelivr.net/gh/ophusgroup/landing@d7c89f4/widgets/section-nav.js
{}
:::

We develop new scanning transmission electron microscopy (STEM) experiments, reconstruction and machine learning algorithms, and open-source software. These tools let us image and understand materials atom by atom. Our research spans three areas:

:::{anywidget} https://cdn.jsdelivr.net/gh/ophusgroup/landing@main/widgets/research-pillars.js
{}
:::



## 4DSTEM Experiments

<!-- ::::{div}
:::{figure} ./videos/research_4DSTEM_02.mp4
:class: float-right
:width: 50%
Comparing conventional ADF-STEM and 4DSTEM.
:::
-->

:::{anywidget} https://cdn.jsdelivr.net/gh/ophusgroup/landing@main/widgets/stem4d-sim.js
{}
:::

In conventional STEM, a focused electron probe is scanned over the sample while detectors record just a few intensity values per position, discarding most of the information encoded in each diffraction pattern. Modern direct electron detectors now operate at up to 120,000 frames/second, allowing us to capture a full 2D diffraction image at every probe position, producing a 4D dataset. We coined the term four-dimensional scanning transmission electron microscopy (4DSTEM) to describe this family of experiments.

Our group has developed many 4DSTEM methods, including nanobeam orientation and phase mapping, inversion of multiple scattering, ptychographic imaging, and ptychographic atomic electron tomography.

- [(2023) Review of STEM in materials science](doi.org/10.1146/annurev-matsci-080921-092646)
- [(2021) 4DSTEM of beam-sensitive materials](doi.org/10.1021/acs.accounts.1c00073)
- [(2019) Review of 4DSTEM](doi.org/10.1017/S1431927619000497)

## 4DSTEM Analysis with py4DSTEM

::::{div}
<div style="width: 20%; float: right; margin-left: 1em;"><img src="/images/research/py4DSTEM_logo_54_export.png" alt="py4DSTEM" style="width: 100%;" /></div>

4DSTEM experiments produce massive datasets. A single scan can hold millions of diffraction patterns, each with tens of thousands of pixels. We developed the open-source [py4DSTEM](https://github.com/py4dstem/py4DSTEM) Python package to analyze these datasets. py4DSTEM supports a wide range of analysis methods, including:

::::

#### nanobeam crystalline diffraction data

- [diffraction pattern indexing for orientation and phase mapping](doi.org/10.1017/S1431927622000101)
- [strain mapping](doi.org/10.1016/j.ultramic.2016.12.021)
- structure classification
<!-- - ML inversion of multiple scattering -->

#### nanobeam amorphous diffraction data

- pair distribution function (PDF) mapping
- [fluctuation electron microscopy](doi.org/10.1063/5.0015532) (FEM)
- strain mapping

#### phase contrast STEM

- center of mass-differential phase contrast (CoM-DPC)
- parallax or tilt-corrected bright field imaging
- ptychography
- [multislice ptychography](doi.org/10.1063/5.0206814)
- joint ptychography-tomography

### ML Inversion of Multiple Scattering

Electrons interact with matter roughly an order of magnitude more strongly than photons. This makes electron microscopy powerful, but it also means that thicker samples and heavy elements scatter the beam multiple times. This multiple scattering produces complex nonlinear contrast that conventional methods cannot analyze.

We use deep learning to predict single-scattering signals from multiply-scattered diffraction patterns, enabling accurate analysis of much thicker crystalline samples.

[Disentangling multiple scattering with deep learning: application to strain mapping from electron diffraction patterns](doi.org/10.1038/s41524-022-00939-9)

### ML Characterization of Disordered Materials

::::{div}
:::{figure} /videos/atomic_struct_04_small.mp4
:class: float-right
:width: 40%
Disordered nanocrystalline silicon.
:::

Many important materials are highly disordered, including functional oxides, silicate glasses, amorphous electrolytes, and polymers. We are generalizing our ML inversion methods to work across the full spectrum, from disordered liquids to crystalline materials.
::::

:::{anywidget} https://cdn.jsdelivr.net/gh/ophusgroup/landing@main/widgets/amorphous-si.js
{}
:::

### STEM Probe Wavefunction Control

:::{figure} /images/research/STEM_probes.png
:alt: STEM probes
:width: 100%
Various STEM probe wavefunctions formed by custom apertures, showing control over both phase and amplitude of the electron beam.
:::

Most STEM experiments use a simple circular aperture to form the electron probe. Our group designs custom STEM wavefunctions by placing patterned structures or devices into the probe-forming aperture, modulating both the phase and amplitude of the electron wave to enable new imaging modes.

#### Phase Plates

::::{div}
<div style="width: 48%; float: right; margin-left: 1em;"><img src="/images/research/phase_plate_01.png" alt="Electrostatic phase plate" style="width: 100%;" /></div>

Unlike light optics, electron microscopy has traditionally been limited to plane wave illumination or simple circular apertures. Our group designs _phase plates_ that sit in the probe-forming aperture to reshape the electron beam. These include passive phase plates for contrast enhancement via our [MIDI-STEM method](doi.org/10.1038/ncomms10719), and active electrostatic apertures that can dynamically modify the beam for applications including [aberration correction](doi.org/10.1093/micmic/ozad111).
::::

#### Amplitude Plates

:::{figure} /images/research/bullseye_probes_02.png
:alt: Amplitude plates with bullseye probe patterns
:width: 100%
Bullseye patterned probes stamp identifiable patterns onto diffracted beams, enabling high-precision strain and orientation measurements.
:::

We also design _amplitude plates_, patterned membranes inserted into the probe-forming aperture that stamp identifiable "bullseye" patterns onto each diffracted beam. This enables our analysis software to extract orientation and strain with much higher precision than conventional methods. See [patterned probes for high precision 4D-STEM bragg measurements](doi.org/10.1016/j.ultramic.2019.112890).

## Atomic Electron Tomography

### 4DSTEM Ptychography

:::{figure} /images/research/figure_AET_ZrTe_DWCNT.jpg
:alt: ZrTe nanowire encapsulated in double-walled carbon nanotube solved with PAET
:width: 80%
:align: center
ZrTe nanowire encapsulated in a double-walled carbon nanotube, solved with PAET.
:::

Our group pioneered ptychographic atomic electron tomography (PAET), combining ptychographic imaging with AET to significantly enhance precision and sensitivity for 3D atomic structure determination, including light elements that are invisible to conventional methods.

- [(2015) 3D positions of individual atoms in materials revealed by electron tomography](doi.org/10.1038/nmat4426)
- [(2017) Deciphering chemical order/disorder and material properties at the single-atom level](doi.org/10.1038/nature21042)
- [(2019) Observing crystal nucleation in four dimensions using AET](doi.org/10.1038/s41586-019-1317-x)
- [(2023) Solving complex nanostructures with PAET](doi.org/10.1038/s41467-023-43634-z)
- [(2024) Atomic-scale identification of active sites of oxygen reduction nanocatalysts](doi.org/10.1038/s41929-024-01175-8)

### ADF-STEM

:::{figure} /images/research/AET_FePt_v01.jpg
:alt: ADF STEM AET tomography of FePt nanoparticle
:width: 100%
AET reconstruction of an FePt nanoparticle [Yang et al. (2017)](doi.org/10.1038/nature21042).
:::

Atomic electron tomography (AET) maps the 3D positions and species of individual atoms by recording atomic-resolution images from many projection directions and applying tomographic reconstruction. ADF-STEM is particularly useful for AET because it provides approximately linear contrast over a wide thickness range, with contrast that depends on atomic species.

### HRTEM Tomography

ADF-STEM provides little contrast for light elements (C, O, Li, H) and requires high beam doses. Phase contrast HRTEM is dose-efficient and sensitive to all atomic species, but produces complex nonlinear contrast. We developed inverse multislice algorithms (with Laura Waller, UC Berkeley) to enable HRTEM-based AET, and applied this to solve the 3D structure of clay layers in vitreous ice, revealing curvature-dependent asymmetric ion concentrations (with Michael Whittaker, Berkeley Lab).

<!-- ## Materials Science Characterization -->

## Data Analysis for Materials Characterization Science

Our group develops computational tools and algorithms for automated, quantitative analysis of electron microscopy data at scale. Central to this effort is [py4DSTEM](https://github.com/py4dstem/py4DSTEM), our open-source Python toolkit for analyzing 4DSTEM datasets, which enables automated mapping of crystal phase, orientation, strain, and other material properties. We also apply deep learning to materials characterization challenges, including segmentation of atomic-resolution images and graph neural network frameworks for accelerated crystal structure classification from electron diffraction data.

- [(2021) py4DSTEM: a software package for 4DSTEM data analysis](doi.org/10.1017/S1431927621000477)
- [(2021) Deep learning segmentation of complex features in atomic-resolution phase-contrast TEM images](doi.org/10.1017/S1431927621000167)

## Atomic Resolution Imaging

Our group develops methods for imaging and analyzing materials at atomic resolution, combining advances in both experiment and computation. We use fused multi-modal electron microscopy to combine elastic and inelastic scattering signals, mapping chemistry at atomic resolution with significantly reduced dose. We also develop image analysis techniques for precisely measuring atomic positions, displacements, and local symmetry from STEM and HRTEM images.

- [(2022) Imaging atomic-scale chemistry from fused multi-modal electron microscopy](doi.org/10.1038/s41524-021-00692-5)

## Scanning Probe Drift Correction

In STEM and SPM, data is recorded sequentially as the probe scans, making measurements susceptible to sample drift from mechanical/thermal motion or beam-induced charging. We developed a drift correction method that combines multiple scans recorded at different angles, using the accurate fast-scan direction from each to correct the slow-scan direction, inspired by tomographic reconstruction algorithms.

Our open-source Matlab implementation is available on [GitHub](https://github.com/cophus/scanning-drift-corr).

## Quantum Mechanical Scattering Simulations

TEM simulation algorithms are essential tools for experiment design, data analysis, and hypothesis testing.

### The PRISM Algorithm

The standard **multislice method** solves the Schrödinger equation with a split-step algorithm, alternating transmission (scattering through each slice) and propagation operators. While efficient for single-wavefunction TEM simulations, STEM requires a separate calculation for each probe position, potentially millions per scan.

Colin developed the **PRISM algorithm** to address this, achieving speedups of f² to f⁴ (with interpolation factor f typically 2–10) at negligible accuracy cost. For large scans, this can be orders of magnitude faster, especially for [inelastic scattering](doi.org/10.1103/PhysRevResearch.1.033186). Extensions include the [partitioned PRISM algorithm](doi.org/10.1017/S1431927621012083) and the related [Lattice Multislice Algorithm](https://arxiv.org/abs/2310.16829). PRISM is implemented in our [Prismatic code](doi.org/10.1016/j.micron.2021.103141) and in [abTEM](doi.org/10.12688/openreseurope.13015.2).

<!-- ### The Prismatic Code -->

### py4DSTEM Diffraction Simulations

We can also use py4DSTEM to perform simulations of diffraction patterns, including kinematical, dynamical (non-zero thickness), simple HRTEM, and even position averaged convergent beam electron diffraction (PABCED) experiments. Try out these Google Colab Tutorials:

- [Dynamical Diffraction Simulations](https://drive.google.com/file/d/1NRZpceoicJxsVp_v9RJ_54RzCVN8HrED/view?usp=drive_link)
- [Kinematical Diffraction Simulations](https://drive.google.com/file/d/1_YONI4P1ylMu4aGWWysYqFhMFdXTd_jw/view?usp=drive_link)
