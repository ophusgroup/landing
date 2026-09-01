---
title: Interactive Ptychography
short_title: Ptychography
description: An interactive multislice electron ptychography demonstration, from 4D-STEM acquisition to gradient-based reconstruction.
---

:::{anywidget} ../widgets/section-nav.js
{}
:::

We develop computational imaging methods that reconstruct the atomic structure of materials from scanning transmission electron microscopy (STEM) measurements. This page demonstrates multislice electron ptychography end to end. The left panel acquires a 4D-STEM dataset from a decahedral metal nanoparticle resting on an amorphous carbon substrate. The right panel reconstructs the sample, one thin slice at a time, directly from the recorded diffraction patterns.

Drag the electron probe across either panel, or press Scan to run a serpentine scan over the full field of view. Flip the left panel between the atomic model and the projected potential slices. Press Reconstruct to run the ptychographic solver and watch the object estimate improve. Reset returns the reconstruction to a blank object.

:::{anywidget} ../widgets/ptycho-ms.js
{}
:::

## How the measurement works

A focused electron probe illuminates a small region of the sample. Because the probe is intentionally defocused, neighboring scan positions overlap strongly, and every region of the sample is measured many times from slightly different illumination conditions. At each of the 11 by 11 scan positions we record the far-field diffraction pattern, giving a four-dimensional dataset: two scan dimensions and two diffraction dimensions.

The simulation here uses a 300 kV beam with a 30 mrad convergence semiangle and 130 angstroms of defocus. The sample contains 11 potential slices: nine slices of a five-fold twinned decahedral nanoparticle, with two amorphous carbon substrate slices below it. Every diffraction pattern is computed live in your browser with the multislice algorithm, which alternates between transmission through each thin slice and Fresnel propagation between slices.

## How the reconstruction works

Ptychography recovers the sample transmission function from the recorded intensities. We parameterize the object as a stack of complex slices and use the same multislice model in the forward direction: the known probe is transmitted through each object slice and propagated between them, and the modeled far-field intensity is compared against the measurement.

The solver minimizes the amplitude error between the modeled and measured diffraction patterns using mini-batch gradient descent. Each iteration selects 11 random probe positions, computes the exact gradient of the loss with respect to every object slice by back-propagating the residual wave through the multislice model, and applies an Adam optimizer update. This is the same pixelated multislice approach used in our quantEM software, with the probe assumed known. The reconstruction starts from a completely blank object.

Because the depth resolution of ptychography is limited to roughly two times the wavelength divided by the square of the convergence angle, about 44 angstroms for these conditions, features smear along the beam direction across neighboring slices. You can see this directly in the reconstructed slice stack: the substrate separates from the particle, but adjacent atomic layers blend together.

## Learn more

Conventional pixel-based reconstructions like this one are sensitive to noise and require careful regularization, especially in three dimensions. We recently introduced deep generative priors for electron ptychography, which parameterize the object and probe with neural networks inside the same automatic-differentiation multislice model. This approach improves noise robustness, convergence speed, and depth regularization. You can read the paper at [doi.org/10.48550/arXiv.2511.07795](https://doi.org/10.48550/arXiv.2511.07795).
