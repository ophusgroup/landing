---
title: Interactive Electron Diffraction
short_title: Diffraction
description: An interactive electron diffraction simulator, with the unit cell and its nanobeam, CBED or Kossel pattern side by side, computed live with Bloch waves.
---

:::{anywidget} ../widgets/section-nav.js
{}
:::

:::{anywidget} ../widgets/diffraction-sim.js
{"preset": "Si (diamond cubic)", "zone_axis": [1, 1, 0], "semiconv_mrad": 3, "thickness_A": 400, "pattern_range": 3.0}
:::

<div style="height: 3rem"></div>

## What the simulation shows

The left panel is the unit cell, the right panel the electron diffraction pattern of the same orientation. Dragging either panel tilts the crystal and the pattern updates as you move. Both panels are drawn as seen from the detector side, looking back up the column, so the face of the cell nearest you is the exit surface and it tilts in the same direction as the Kikuchi lines and the bright region of the pattern. The x and y axes of the two panels coincide, and the beam energy is 200 keV.

The default mode is nanobeam diffraction: each Bragg reflection appears as a disk whose radius is the convergence semiangle of the probe (3 mrad by default) and whose brightness follows its diffracted intensity, scaled to the strongest diffracted beam so that the direct beam saturates and the weak outer reflections stay visible. The thickness slider changes the intensities without moving the disks, the convergence slider changes only the disk size, and the pattern range sets the largest scattering vector shown. The CBED mode computes the intensity across each disk for a grid of incident directions inside the convergence cone, so the disks fill with rocking curves once the semiangle exceeds a few milliradians. The Kossel mode draws the deficient line of every reflection in the plane of incident directions, with the line width equal to the two-beam rocking width and the darkness proportional to the coupling of the reflection. The Kikuchi lines checkbox overlays the same line pairs on the nanobeam pattern; the dark line of each pair passes through the direct beam and the bright line through the reflection when that reflection is exactly at the Bragg condition.

Double-clicking a point of the pattern tilts the crystal by the angle of that point, the scattering vector divided by the wavevector, so the clicked direction moves onto the optic axis. These are milliradian rotations: with the Kikuchi lines on, double-clicking the pole where the line pairs cross brings that zone axis onto the beam, and double-clicking on a spot puts the zone axis on the side of that reflection. The brightness exponent slider and the histogram set the intensity scaling of the pattern; the default exponent of 0.5 shows the square root of the intensity, the default window saturates everything above half of the strongest diffracted beam, and dragging the histogram handles changes the window. The structure menu covers the common cubic and hexagonal metals and semiconductors, rocksalt, perovskite and corundum; the polyhedra checkbox draws the coordination polyhedra around the cations, and the cells field draws a block of up to 3 by 3 by 3 cells.

## How the intensities are computed

Every intensity is computed in your browser. The reflections of the primitive reciprocal lattice out to 3 inverse angstroms are stored for each structure, with their kinematical structure factors from the electron scattering factors of Lobato and Van Dyck, and their Bloch wave couplings from the absorptive form factors of Weickenmeier and Kohl at 200 keV. Both sets of factors are the ones used by our quantEM software, which also generated the data for this page.

With the dynamical option on, the reflections within 0.05 inverse angstroms of the Ewald sphere enter a Bloch wave calculation following Bethe: the structure matrix built from the couplings is diagonalized, the eigenvectors are excited by the incident beam, and the diffracted amplitudes at the exit surface follow from the thickness and the eigenvalues. Absorption enters to first order through the imaginary part of the potential, which damps every Bloch wave at its own rate. For silicon along [110] this set holds about 60 beams. The many reflections further from the sphere take the thin-slab intensity, the square of the coupling times the thickness times a sinc-squared function of the excitation error, which is the weak-beam limit of the same calculation. This is why the outer reflections fade with distance from the zone axis and sharpen as the thickness grows. With the dynamical option off, every reflection takes its kinematical structure factor with a Gaussian envelope in the excitation error, the model used for orientation mapping of scanning nanobeam diffraction data.

Two effects of multiple scattering are easy to see in silicon along [110]. The 002 and 222 reflections have zero structure factor because of the diamond glide, and the kinematical pattern leaves them empty; the Bloch wave pattern fills them by double diffraction, since 111 plus 11̄1 equals 002. The intensities of all beams oscillate with thickness, the Pendellösung effect: the 220 extinction distance at 200 keV is 760 angstroms, so the 220 disks pass through a minimum near 380 angstroms and recover by the time the slider reaches 760.

## Learn more

The Bloch wave formulation of dynamical electron diffraction is due to Bethe, [Annalen der Physik 87, 55 (1928)](https://doi.org/10.1002/andp.19283921704). The absorptive form factors are from Weickenmeier and Kohl, [Acta Crystallographica A 47, 590 (1991)](https://doi.org/10.1107/S0108767391004774), and the elastic scattering factors from Lobato and Van Dyck, [Acta Crystallographica A 70, 636 (2014)](https://doi.org/10.1107/S205327331401643X). De Graef's [Introduction to Conventional Transmission Electron Microscopy](https://doi.org/10.1017/CBO9780511615092) and Zuo and Spence's [Advanced Transmission Electron Microscopy](https://doi.org/10.1007/978-1-4939-6607-3) develop the Bloch wave method, CBED and Kikuchi patterns in the notation used here; Kirkland's [Advanced Computing in Electron Microscopy](https://doi.org/10.1007/978-3-030-33260-0) covers the numerical side.

We use these simulations to index scanning nanobeam diffraction data. The 4D-STEM review in [Microscopy and Microanalysis 25, 563 (2019)](https://doi.org/10.1017/S1431927619000497) describes the measurements, and the orientation mapping method with kinematical pattern matching is in [Microscopy and Microanalysis 28, 390 (2022)](https://doi.org/10.1017/S1431927622000101). The simulator, the orientation and phase mapping, and the dynamical refinement on Bloch wave intensities are part of quantEM, at [github.com/electronmicroscopy/quantem](https://github.com/electronmicroscopy/quantem); the same widget runs inside Jupyter as `quantem.widget.DiffractionSim` with additional structures loaded from CIF files.
