---
title: Interactive Simulations
---

:::{anywidget} https://cdn.jsdelivr.net/gh/ophusgroup/landing@d7c89f4/widgets/section-nav.js
{}
:::

## Interactive 4DSTEM Diffraction Simulation

Drag the electron probe across the polycrystalline sample to see how the diffraction pattern changes at each position. Use the sliders to switch between nanobeam diffraction (small convergence semiangle, separated Bragg disks) and ptychographic (large semiangle, overlapping disks) imaging modes. The defocus slider shifts the probe crossover, changing the illumination on the sample.

:::{anywidget} https://cdn.jsdelivr.net/gh/ophusgroup/landing@main/widgets/stem4d-sim.js
{}
:::

## Interactive Disordered Silicon Simulation

Explore how atomic disorder affects electron diffraction and local structure. The disorder slider progressively rotates random sub-volumes of a silicon crystal, destroying medium- and long-range order while preserving short-range tetrahedral bonding. Drag to rotate the 3D structure and watch the diffraction pattern and nearest-neighbor angular correlation evolve in real time.

:::{anywidget} https://cdn.jsdelivr.net/gh/ophusgroup/landing@main/widgets/amorphous-si.js

{}
:::

## Interactive Paper / Demo SOP

:::{attention}
This section is currently a work in progress
:::

### Purpose

This SOP aims to create a standard methodology for creating an interactive paper to be published on the curvenote/mystmd platform of the website.

### Application

This document describes the necessary steps to creating the interactive paper as well as considerations that should be made before uploading to the website.

### General procedure steps

1. Determine and outline what content you would like to turn into an interactive paper/demo
2. Decide where you'd like to start with your repository either in the OphusGroup Organization or Personal repository
3. Create a Fork of the [EM-Quickstart GitHub Repository](https://github.com/msa-em/em-quickstart) and follow the README instructions to setup the environment locally

   - You will need a version of python as well as node.js in order to get started with the website

4. Developing your [ipywidgets](https://ipywidgets.readthedocs.io/en/stable/) demonstrations in jupyter notebooks in the notebooks folder
5. Add content and widgets into your final document
6. Test all content in local host version of site

   - Adjust myst.yml file

7. Upload to the final location

   - Make sure to adjust myst.yml file

### Adding content

#### [Add static media and Videos](https://mystmd.org/guide/figures)

ie. Image, GIF, mp4, Youtube Video

#### Responsive plotting

ie. Change in plot from a slider, numeric input, etc — see f_sampling.ipynb in the [Interactive PRISM Repository](https://github.com/ophusgroup/interactive-prism)

#### Dynamic movies

ie. Change a movie from a slider, numeric input, etc — see probe_construction_movie.ipynb in the [Interactive PRISM Repository](https://github.com/ophusgroup/interactive-prism)

### Resources

- [EM-Quickstart GitHub Repository](https://github.com/msa-em/em-quickstart)
- [Interactive PRISM Repository](https://github.com/ophusgroup/interactive-prism)
- [MyST Documentation](https://mystmd.org/guide/typography)
- [ipywidgets Documentation](https://ipywidgets.readthedocs.io/en/stable/)
