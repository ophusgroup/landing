---
title: Interactive Paper/Demo SOP
---

:::{attention}
This page is currently a work in progress
:::

## Purpose

This SOP aims to create a standard methodology for creating an interactive paper to be published on the curvnote/mystmd
platform of the website.

## Application

This document describes the necessary steps to creating the interactive paper as well as considerations that should be made
before uploading to the website.

## General Procedure Steps

1. Determine and outline what content you would like to turn into an interactive paper/demo
2. Decide where you'd like to start with your repository either in the OphusGroup Organization or Personal repository
3. Create a Fork of the [EM-Quickstart GitHub Repository](https://github.com/msa-em/em-quickstart) and follow the README instructions to setup the environment locally

- You will need a version of python as well as node.js in order to get started with the website

4. Developing your [ipywidgets](https://ipywidgets.readthedocs.io/en/stable/) demonstrations in jupyter notebooks in the notebooks folder
5. Add content and widgets into your final document
6. Test all content in local host version of site

- Adjust myst.yml file

7. Upload to the final location

- Make sure to adjust msyt.yml file

## Adding Content

### [Add static media and Videos](https://mystmd.org/guide/figures)

ie. Image, GIF, mp4, Youtube Video

### Responsive Plotting

#### ie. Change in plot from a slider, numeric input, etc

see f_sampling.ipynb in [Ex Repository: Interactive PRISM Repository](https://github.com/ophusgroup/interactive-prism)

### Dynamic Movies

#### ie. Change a movie from a slider, numeric input, etc

see probe_construction_movie.ipynb in [Ex Repository: Interactive PRISM Repository](https://github.com/ophusgroup/interactive-prism)

## Resources

- [EM-Quickstart GitHub Repository](https://github.com/msa-em/em-quickstart)
- [Ex Repository: Interactive PRISM Repository](https://github.com/ophusgroup/interactive-prism)
- [MyST Documentation](https://mystmd.org/guide/typography)
- [ipywidgets Documentation](https://ipywidgets.readthedocs.io/en/stable/)
