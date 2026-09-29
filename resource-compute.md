---
title: Compute Resources
short_title: Compute
description: Getting started on the COLab GPU servers (mallard, buffle) and shared storage (wigeon).
---

:::{anywidget} ./widgets/section-nav.js
{}
:::

COLab runs two shared GPU servers and a storage server. This page covers what you need to get started; ask someone in the group for anything not covered here.

## The machines

| Server      | GPUs                                     | CPU / RAM               | Notes                                                              |
| ----------- | ---------------------------------------- | ----------------------- | ------------------------------------------------------------------ |
| **mallard** | 4× NVIDIA L40S (48 GB each)              | 64-core AMD EPYC, 512 GB | Default server for everyone. Fast local scratch. |
| **buffle**  | 4× NVIDIA RTX Pro 6000 (96 GB each)      | dual CPU (256 threads), 512 GB | Newer, larger GPUs. Ask for access if you need it.          |
| **wigeon**  | —                                        | —                       | Storage server. Not a login host; its disks appear on both servers under `/wigeon`. Globus endpoint. |

Connect with `ssh <sunetid>@mallard.stanford.edu` or `ssh <sunetid>@buffle.stanford.edu`. You must be on the Stanford network or the [VPN](#vpn-access-from-off-campus).

There is no job scheduler. Everyone shares the machines directly, so please read the [etiquette](#sharing-the-servers) section.

## Accounts

- Your username is your **SUNet ID**. Accounts are managed centrally, so one username and password works on both servers.
- To get an account (or access to buffle), ask someone in the group to put you in touch with the current admin. You will receive a temporary password; log in once and run `passwd` to change it.
- SSH keys work as normal: put your public key in `~/.ssh/authorized_keys` on each server (home directories are separate per server).


## Basics

- **Bash**: [Microsoft's Introduction to Bash](https://learn.microsoft.com/en-us/training/modules/bash-introduction/) covers the essentials; [explainshell](https://explainshell.com/) decodes commands you copy from StackOverflow.
- **Git & GitHub**: It is worth learning the [basics](https://xkcd.com/1597/) of `git` and `GitHub` as these are the tools we use for managing our projects. There are some [excellent interactive resources available](https://learngitbranching.js.org/) (note the tutorials that include a remote) as well as [slides](https://docs.google.com/presentation/d/1WZb3w1SYOxGW1coMqJXrM8yEyLSS9RCl/edit?usp=sharing&ouid=116704770862661131657&rtpof=true&sd=true).
- **Windows users**: the [Windows Subsystem for Linux](https://learn.microsoft.com/en-us/windows/wsl/install) gives you a proper terminal.


## Where to put your data

Both servers see the same shared storage, so a file saved to `$DATA` on mallard is there on buffle too. Home and scratch are local to each server.

| Location        | Variable   | Servers | Use it for                                                                                        |
| --------------- | ---------- | ------- | ------------------------------------------------------------------------------------------------- |
| `/home/<user>`  | `$HOME`    | each server separately | Dotfiles, conda environments, code. **Not** for datasets: the disk is small and shared with the OS. |
| `/wigeon/users/<user>` | `$DATA`   | both    | **Your data.** Large, private to you, backed by wigeon. Use this for anything you want to keep.  |
| `/wigeon/shared` | `$SHARED` | both    | Group data: shared datasets, project folders, things collaborators need. Everyone can read and write. |
| `/data/users/<user>` | `$SCRATCH` | mallard only | Fast local NVMe scratch for active jobs. Not backed up; treat as temporary.                   |

Tips:

- `cd $DATA` works from any shell; the variables are set for you at login.
- Please don't leave large datasets in `$HOME`. Your home directories should be kept smaller than 250 GB. You can get an idea of your storage usage with `du -sh ~/*`

## Moving data in and out

- **Globus** is the best option for anything large. Log in at [app.globus.org](https://app.globus.org) with your Stanford account and search for the collections `Stanford Wigeon on Mallard /wigeon/users` (your `$DATA`) or `Stanford Wigeon on Mallard /wigeon/shared`. To transfer from your own computer, install [Globus Connect Personal](https://www.globus.org/globus-connect-personal). Globus transfers go straight to wigeon, so the files show up on both servers.
- **Small transfers**: `scp`/`rsync` from the command line, or a GUI client like [CyberDuck](https://cyberduck.io/) or [WinSCP](https://winscp.net/eng/index.php). VS Code's remote file browser also lets you drag and drop.
- **Microscope data** streamed from the TEM lands in `/wigeon/streaming` (read-only). Copy what you need into `$DATA` or `$SHARED`.

## Getting started with Python

1. SSH in to verify your connection.
2. Install [miniforge](https://conda-forge.org/download/) (preferred) or miniconda for Linux x86_64 into your home directory: download the installer with `curl`, then `bash <installer>.sh` and follow the prompts.
3. Create a [new environment](https://docs.conda.io/projects/conda/en/latest/user-guide/tasks/manage-environments.html) per project. With miniforge, use `mamba` in place of `conda` for speed.
4. Some projects, including [quantEM](https://github.com/electronmicroscopy/quantem), use [uv](https://docs.astral.sh/uv/) instead. Its [getting started](https://docs.astral.sh/uv/getting-started/) guide is short.

**VS Code** is the most common way people work on the servers: install the *Remote - SSH* extension, run `Remote-SSH: Add New SSH Host` from the command palette (`ctrl + shift + p`), then `Connect to Host`. You can then open folders and notebooks as if they were local.

## VPN access from off campus

1. Download the client from [uit.stanford.edu/service/vpn](https://uit.stanford.edu/service/vpn).
2. Connect to `su-vpn.stanford.edu` with your Stanford credentials.
3. SSH in as usual.

## Sharing the servers

There is no scheduler; it is therefore the users' responsibility to not run over each others' jobs.

### Pick a free GPU

1. Check what is in use with `nvidia-smi` or `nvtop` (the latter shows which user owns each job).
2. Select an unused GPU in your code:

   ```python
   import torch
   torch.cuda.set_device(xx)      # xx is the GPU index, 0-3

   import cupy as cp
   cp.cuda.Device(xx).use()
   ```

   or limit what your process can see at all:

   ```python
   import os
   os.environ["CUDA_DEVICE_ORDER"] = "PCI_BUS_ID"   # consistent numbering
   os.environ["CUDA_VISIBLE_DEVICES"] = "1,3"       # set before importing torch/cupy
   ```

   With quantEM, `config.set_device(2)` sets the device for torch and cupy together.

3. When you are done, make sure your job (or a hung Jupyter kernel) has actually released the GPU. `nvtop` should no longer list your process.

### Don't grab every CPU core

Many packages (`torch`, `abtem`, `ase`, `construction_zone`, ...) default to using every thread on the machine, which problematic for other users. Unless you deliberately need multi-threading, put this at the top of scripts and notebooks:

```python
import os
os.environ["OMP_NUM_THREADS"] = "1"   # before importing numpy/torch

import torch
torch.set_num_threads(1)              # torch ignores OMP_NUM_THREADS for .cpu() work
```

- `abtem`, `ase`, `construction_zone`: always `N=1`; these get no real benefit from more cores. Modern abtem (≥1.0.1) ignores the environment variable, so use `abtem.config.set({"device": "gpu", "num_workers": 1})` ([docs](https://abtem.readthedocs.io/en/latest/user_guide/walkthrough/parallelization.html#using-gpus)).
- `torch`: `N=1` for small-scale training. For large datasets with many small files, a `DataLoader` with `num_workers=4` and threads set to match can help; measure before assuming.
- Check `htop` occasionally while running something heavy to make sure it behaves.

### Long-running jobs

Disconnecting from SSH normally kills your jobs. Run long scripts inside [tmux](https://github.com/tmux/tmux/wiki/Getting-Started) so they survive. There are many useful cheat sheets for `tmux` commands, but the most common are: 

- New named session: `tmux new -s <name>`
- Detach: `ctrl + b` then `d`
- Reattach: `tmux a -t <name>`
- List sessions: `tmux ls`

This doesn't help with notebooks in VS Code, where the kernel dies with the connection. Running a standalone Jupyter server and connecting to it is one workaround; do let us know if you find a better one.

## Getting help

- Something broken (can't log in, disk full, `/wigeon` missing)? Ask in the group chat so the admin sees it.
- Questions about packages, environments, or GPU code: ask in the group chat; someone has probably hit it before.
