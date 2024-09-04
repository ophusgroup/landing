---
title: Research
---

## 4DSTEM

### Experiments

+++ {"class": "col-"}

:::{figure} ./videos/research_4DSTEM.mp4
:class: md:float-right ml-4
Comparing conventional ADF-STEM and 4DSTEM.
:::

Scanning transmission electron microscopy (STEM) has become an essential tool for materials science research, where it has been applied to atomic-scale imaging, diffraction, spectroscopy, and 3D tomography of many materials. In conventional STEM imaging, we scan a converged electron probe in a 2D grid over the sample, recording 1-5 intensity values from detectors which count the electrons scattered over a large angular range. Complex electron diffraction patterns which encode a lot of atomic-scale sample information are therefore reduced to only a few measurement values in conventional STEM imaging.

However, we now have direct electron detectors which can operate at speeds up to 120,000 frames / second. These detectors allow us to record a full 2D image of the diffracted electron beam over a 2D grid of probe positions, generated a 4D dataset. We therefore coined the term four-dimensional scanning transmission electron microscopy (4DSTEM) to describe this family of experiments.

Our group has developed many kinds of 4DSTEM experiments, including nanobeam orientation and phase mapping, inversion of multiple scattering with physics and machine learning approaches, ptychographic imaging, ptychographic atomic electron tomography, and many others.

- [(2019) Review on 4DSTEM](doi.org/10.1017/S1431927619000497)
- [(2021) 4DSTEM of beam-sensitive Materials](https://doi.org/10.1021/acs.accounts.1c00073)
- [(2023) Review on STEM in materials science](doi.org/10.1146/annurev-matsci-080921-092646)

### Analysis with py4DSTEM

```{image} /images/research/py4DSTEM_logo_54_export.png
:alt: py4DSTEM
:class: md:float-right ml-4
:width: 300px
:align: right
```

4DSTEM experiments produce prodigious amounts of data - potentially millions of diffraction pattern images, each with tens of thousands of pixels. We have developed robust and efficient algorithms to analyze these huge 4DSTEM datasets, primarily implemented into open-source py4DSTEM python package developed by our group for analysis of 4DSTEM data. py4DSTEM provides researchers with a powerful, flexible, and user-friendly toolkit for processing and interpreting large-scale 4DSTEM data. The code supports a wide range of functionalities, including

#### nanobeam crystalline diffraction data
- diffraction pattern indexing for orientation and phase mapping
- strain mapping
- structure classification
- ML inversion of multiple scattering

#### nanobeam amorphous diffraction data
- pair distribution function (PDF) mapping
- fluctuation electron microscopy (FEM)
- strain mapping

#### phase contrast STEM
- center of mass-differential phase contrast (CoM-DPC)
- parallax or tilt-corrected bright field imaging
- ptychography
- joint ptychography-tomography


### Custom apertures

Crystalline diffraction patterns






## Atomic Electron Tomography

### 4DSTEM Ptychography

:::{figure} ./images/research/figure_AET_ZrTe_DWCNT.jpg
:align: center
:width: 500px
ZrTe nanowire encapsulated in double-walled carbon nanotube solved with, from @doi.org/10.1038/s41467-023-43634-z.
:::

Our group pioneered the development of ptychographic atomic electron tomography, where we combined ptychography imaging with AET. This approach significantly enhances the precision and sensitivity of atomic structure determination, enabling the visualization of complex nanostructures, including light elements. PAET has the potential to significantly expand the range of nanostructures that can be resolved in 3D at atomic resolution, and provide deeper insights into the atomic-scale underpinnings of material properties

- [(2015) 3D positions of individual atoms in materials revealed by electron tomography](https://dx.doi.org/10.1038/nmat4426)
- [(2017) Deciphering chemical order/disorder and material properties at the single-atom level](dx.doi.org/10.1038/nature21042)
- [(2019) Observing crystal nucleation in four dimensions using AET](https://doi.org/10.1038/s41586-019-1317-x)
- [(2023) Solving complex nanostructures with PAET](doi.org/10.1038/s41467-023-43634-z)
- [(2024) Atomic-scale identification of active sites of oxygen reduction nanocatalysts](https://doi.org/10.1038/s41929-024-01175-8)





### ADF-STEM

Atomic electron tomography (AET) reconstructs the three-dimensional structures of materials at atomic resolution. By recording high-resolution STEM images from many projection directions and then using tomographic reconstruction algorithms, we can use AET to map the 3D positions and species of atoms within complex nanostructures. This method is invaluable for studying defects, interfaces, and other structural intricacies in materials that influence their properties. AET has transformative applications in materials science, catalysis, and nanotechnology, offering unprecedented insights into the atomic-scale architecture of advanced materials.



### HRTEM Tomography



<!-- ## Materials Science Characterization -->

## Data Analysis for Materials Characterization Science

## Atomic Resolution Imaging

## Scanning Probe Drift Correction

## ML Inversion of Multiple Scattering

## ML Characterization of Disordered Materials

## Quantum Mechanical Scattering Simulations

### The PRISM Algorithm

### The Prismatic Code

### py4DSTEM Diffraction Simulations
