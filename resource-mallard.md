---
title: Mallard SOP
---

Mallard is the group's first GPU server with 4 Nvidia L40s GPUs and 512 GB RAM. 

## Getting started with python on mallard
- Verify your connection and install conda:
    1. ssh into `<username>@mallard.stanford.edu` to verify your connection. You will need to be on Stanford's network or on the VPN if off campus.
    2. Download the installer for [miniforge](https://conda-forge.org/download/) (preferred) or miniconda for Linux x86_64, and transfer the file to your home folder, e.g. with [CyberDuck](https://cyberduck.io/) or [winSCP](https://winscp.net/eng/index.php).
    3. Install conda `$bash <installer>.sh` and follow the prompts
    4. Create a [new environment](https://docs.conda.io/projects/conda/en/latest/user-guide/tasks/manage-environments.html) for your project as normal.
- Connecting from VS Code
    1. Download [VS Code](https://code.visualstudio.com/download) and then install the Remote Explorer extension.
    2. In VS Code, open the command prompt (`ctrl + shift + p`) and run `Remote-SSH: Add New SSH Host`, then `Connect to Host`
    3. Thats it! You are now on mallard and can open folders or notebooks and run code as normal.
## Using the GPUs on mallard  
We do not currently use a job scheduler on mallard. It is therefore the users' responsibility to not run over each others' jobs.  

Whenever using mallard, remember to always: 
1. Check which GPUs have running jobs with either `nvidia-smi` or `nvtop`. `nvtop` will also let you see which users are running which jobs.
2. Select an available GPU to use with your code. There are multiple ways of doing this depending on the packages you are using.
    - If using [CuPy](https://cupy.dev/):
        ```python
        import cupy as cp
        cp.cuda.Device(xx).use() #  where xx is the gpu index, 0-3
        ```
    - If using [PyTorch](https://pytorch.org/):
        ```python
        import torch
        torch.cuda.set_device(xx)
        ```
    - Alternatively, you can limit the accesible GPUs via environment variables, for example:
        ```python
        import torch
        print("num GPUs a: ", torch.cuda.device_count())

        import os
        os.environ["CUDA_DEVICE_ORDER"] = "PCI_BUS_ID"  # consistent GPU ordering
        os.environ["CUDA_VISIBLE_DEVICES"] = "1,3" 
        print("num GPUs b: ", torch.cuda.device_count())
        ```
        > num GPUs a: 4  
        > num GPUs b: 2  

        Now running `torch.cuda.set_device(1)` would map torch to GPU 3, as the two visible devices are GPUs 1 and 3.

### Misc.
- Use [tmux](https://github.com/tmux/tmux/wiki) to enable long jobs to continue running after disconnecting from mallard. 
    - You could also potentially set up a [Jupyter server](https://github.com/microsoft/vscode-jupyter/issues/1378#issuecomment-1819466769) and connect to it manually, so that notebooks aren't killed on disconnect. Maybe one day Microsoft will [address the issue](https://github.com/microsoft/vscode-jupyter/issues/3998), but I'm not holding my breath.
- It's possible for hung ipython kernels to not properly disconnect and clear the GPU. Please make sure there are no (unintentional) jobs left running when you are ready to disconnect. 