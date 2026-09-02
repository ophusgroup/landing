---
title: Interactive Ptychography
short_title: Ptychography
description: An interactive multislice electron ptychography demonstration, from 4D-STEM acquisition to gradient-based reconstruction.
---

:::{anywidget} ../widgets/section-nav.js
{}
:::

:::{anywidget} ../widgets/ptycho-ms.js
{}
:::

<div style="height: 3rem"></div>

## How the measurement works

A focused electron probe illuminates a small region of the sample. Because the probe is intentionally defocused, neighboring scan positions overlap strongly, and every region of the sample is measured many times from slightly different illumination conditions. At each of the 15 by 15 scan positions we record the far-field diffraction pattern, giving a four-dimensional dataset: two scan dimensions and two diffraction dimensions.

The simulation here uses a 300 kV beam, an adjustable convergence semiangle (the angle slider spans 10 to 40 mrad), and a strongly defocused probe (the defocus slider spans 200 angstroms of overfocus to 200 angstroms of underfocus, with C1 equal to minus the defocus). Larger convergence angles reach higher scattering angles and sharpen the depth resolution; more defocus spreads the illumination over more of the sample. The sample is a five-fold twinned decahedral nanoparticle with triangular 111 surface facets, embedded in an amorphous carbon substrate that fills the field of view. Every diffraction pattern in the 15 by 15 scan is computed live in your browser with the multislice algorithm, which alternates between transmission through each thin slice and Fresnel propagation between slices.

## How the reconstruction works

Ptychography recovers the sample transmission function from the recorded intensities. We parameterize the object as a stack of complex slices and use the same multislice model in the forward direction: the known probe is transmitted through each object slice and propagated between them, and the modeled far-field intensity is compared against the measurement.

The solver minimizes the amplitude error between the modeled and measured diffraction patterns using mini-batch gradient descent. Each iteration selects a small random batch of probe positions, computes the exact gradient of the loss with respect to every object slice by back-propagating the residual wave through the multislice model, and applies an Adam optimizer update. This is the same pixelated multislice approach used in our quantEM software, with the probe assumed known. The reconstruction uses six slices, each 15 angstroms thick, and starts from a completely blank object.

Because the depth resolution of ptychography is limited to roughly two times the wavelength divided by the square of the convergence angle (tens of angstroms here, shrinking as you raise the convergence angle), features smear along the beam direction across neighboring slices. You can see this directly in the reconstructed slice stack: the flat nanoparticle and the substrate blur across several slices, including the empty padding slices above and below the sample.

## Learn more

Conventional pixel-based reconstructions like this one are sensitive to noise and require careful regularization, especially in three dimensions. We recently introduced deep generative priors for electron ptychography, which parameterize the object and probe with neural networks inside the same automatic-differentiation multislice model. This approach improves noise robustness, convergence speed, and depth regularization. You can read the paper at [doi.org/10.48550/arXiv.2511.07795](https://doi.org/10.48550/arXiv.2511.07795).

To work through the algorithms behind this demo yourself, see our diffractive imaging tutorials for quantEM at [github.com/electronmicroscopy/quantem-tutorials](https://github.com/electronmicroscopy/quantem-tutorials/tree/main/tutorials/diffractive_imaging).
