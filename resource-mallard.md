---
title: Mallard SOP
---

Mallard is the group's first GPU server with 4 Nvidia L40s GPUs, a 64-core AMD Epyc CPU, and 512 GB RAM. 

## Basics
Here are a few resources that cover some of the basics that are useful when working on a Linux server like Mallard. 
- Bash shell
    - The [Microsoft "Introduction to Bash"](https://learn.microsoft.com/en-us/training/modules/bash-introduction/) is great and covers all the essentials. [Explainshell](https://explainshell.com/) is a useful resource to help one understand the things they copy and paste from StackOverflow.
    - For long-running jobs and generally maximizing productivity, [tmux](https://github.com/tmux/tmux/wiki/Getting-Started) is wonderful and there are lots of [cheat sheets](https://duckduckgo.com/?t=ffab&q=tmux+cheat+sheet&ia=images&iax=images) available.
- Git & Github
    - It is worth learning the [basics](https://xkcd.com/1597/) of `git` and `GitHub` as these are the tools we use for managing our projects. There are some [excellent interactive resources available](https://learngitbranching.js.org/) (note the tutorials that include a remote) as well as [slides](https://docs.google.com/presentation/d/1WZb3w1SYOxGW1coMqJXrM8yEyLSS9RCl/edit?usp=sharing&ouid=116704770862661131657&rtpof=true&sd=true). 
- Moving data to/from mallard
    - The fastest way to move large datasets to/from Mallard is using Globus. Install a [local endpoint](https://www.globus.org/globus-connect-personal) on your computer and you can then [transfer files](https://docs.globus.org/guides/tutorials/manage-files/transfer-files/) using the web app as long as you have linked your Stanford account. 
    - For small transfers you can also use command line tools like SCP or applications like  [CyberDuck](https://cyberduck.io/) or [winSCP](https://winscp.net/eng/index.php).
- WSL
    - If your personal computer is a Windows machine, you can also access a Linux distribution (pref. Ubuntu) using the [Windows Subsystem for Linux](https://learn.microsoft.com/en-us/windows/wsl/install). 


## Getting started with python on mallard
- Verify your connection and install conda:
    1. ssh into `<username>@mallard.stanford.edu` to verify your connection. You will need to be on the Stanford internal network or on the VPN if off campus.
    2. Download the installer for [miniforge](https://conda-forge.org/download/) (preferred) or miniconda for Linux x86_64. You can either use the appropriate `curl` command or download to your local computer and transfer the file to your home folder. 
    3. Install conda `$bash <installer>.sh` and follow the prompts
    4. Create a [new environment](https://docs.conda.io/projects/conda/en/latest/user-guide/tasks/manage-environments.html) for your project as normal.
    5. If you installed miniforge, it is suggested to use the drop in `mamba` commands rather than `conda` for managing environments.  
    
- Connecting from VS Code
    1. Download [VS Code](https://code.visualstudio.com/download) and then install the Remote Explorer extension.
    2. In VS Code, open the command prompt (`ctrl + shift + p`) and run `Remote-SSH: Add New SSH Host`, then `Connect to Host`
    3. Thats it! You are now on mallard and can open folders or notebooks and run code as normal.

- Astral uv package manager
    - Some projects (including [quantEM](https://github.com/electronmicroscopy/quantem)) use [uv](https://docs.astral.sh/uv/) as a package and environment manager.  
    - It might be useful to go through their [getting started](https://docs.astral.sh/uv/getting-started/) information if you plan on contributing to quantEM. 

## Allocating CPUs on mallard

Some packages (`torch`, `abtem`, `ase`, `construction_zone`, ...) may potentially allocate all available [threads](https://www.liquidweb.com/blog/difference-cpu-cores-thread/#h-the-difference-between-cores-vs-threads) which could become problematic performance-wise as mallard is a *shared* server. Unless the script/notebook that is running has intentional multi-processing/multi-threading capabilities, it is good practice to instantiate the following at the top of your script or notebook:

```python
import os
os.environ["OMP_NUM_THREADS"] = "N" # Change N to required number of threads, 
                                    # often N=1 is sufficient for most workloads.

import torch
torch.set_num_threads(N) # When using .cpu(), PyTorch will also allocate all cores
                         # regardless if you set your os environment variable.
```

The use cases of multi-processing or multi-threading is dependent on the specific needs of the project. And often before pursuing either options, it is advised to ask someone if there are no other optimizations to be made to boost performance. Here are a few situations where increasing `N` to be greater than 1 makes sense, and should be avoided:

1. `abtem` / `ase` / `construction_zone`
    - When using these packages one should **always** limit their threads to `N=1`. These packages will always allocate all available CPU cores without substantial performance gains. 
    - Simulating nanoparticles does not require fast I/O operations, but does the bulk of the work on the specified GPU.
    - Note with **modern abtem** (1.0.1 or later) you have to use following config options as they will **ignore** `os.environ` variables.:
        - `abtem.config.set{{"device":"gpu"}}`: Sets the default device to the gpu.
        - `abtem.config.set{{"num_workers": 1}}`: Sets the number of CPU cores to use.
        - More options can be found on this [page](https://abtem.readthedocs.io/en/latest/user_guide/walkthrough/parallelization.html#using-gpus)

2. `torch`
    - `torch` will also always allocate all available CPU cores so one should limit the number of threads to `N=1` *if* the training is still at small-scale. 
    - In large datasets, especially when individual file sizes are small, spawning more than 1 thread can lead to performance boosts. An example of a use case is using `torch.utils.data.Dataloader`:
        ```python
        train_dataloader = torch.utils.data.DataLoader(
            train_set,
            batch_size = 2 ** self.train_params["batch_size_power"],
            shuffle = self.train_params["shuffle"],
            pin_memory = True,
            num_workers = 4, # Enables multi-processed data-loading.
        )
        ```
        In this case, it is advised to set the number of threads to be the same as `num_workers`. Depending on how large your dataset is, it may be necessary to run an analysis on the number of threads vs runtime.
    
** There might be cases where these measures aren't sufficient and your program can use more cores than anticipated; if you're doing something heavy it's a good idea to occasionally check `htop` to make sure things are running as expected. 
    
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
        print("num GPUs at first: ", torch.cuda.device_count())

        import os
        os.environ["CUDA_DEVICE_ORDER"] = "PCI_BUS_ID"  # consistent GPU ordering
        os.environ["CUDA_VISIBLE_DEVICES"] = "1,3" 
        print("num GPUs now: ", torch.cuda.device_count())
        ```
        > num GPUs at first: 4  
        > num GPUs now: 2  

        Now running `torch.cuda.set_device(1)` would map torch to GPU 3, as the two visible devices are GPUs 1 and 3. 
    - If you are using `quantEM`, you can use the `config` module to set the device for torch, cupy, etc. simultaneously. For example:
        ```python 
        from quantem.core import config
        config.set_device(2)
        print(config.get_device())
        ```
        > cuda:2

## Misc.
- Disconnecting from mallard will normally end any running jobs, but you can use a terminal multiplexer such as [tmux](https://github.com/tmux/tmux/wiki) to enable long jobs to continue running regardless.
    - There are many useful [cheat sheets](https://is.gd/MZGSSw) showing how to get started with tmux, as well as [their own documentation](https://github.com/tmux/tmux/wiki/Getting-Started). Regardless, the most useful commands are: 
        - Make and connect to a new named session: `tmux new -t <name>`
        - Disconnect from a session: `ctrl + b` $\rightarrow$ `d`
        - Reconnect to a named session: `tmux a -t <name>`
        - List all current sessions: `tmux ls` 
    - This method works fine for scripts, but does not apply directly to notebooks. I use VS Code for remote developments, and there isn't a super easy way (that I know of) to maintain the jupyter kernel upon disconnect. One potential option would be to set up a [Jupyter server](https://github.com/microsoft/vscode-jupyter/issues/1378#issuecomment-1819466769) and connect to it manually. Maybe one day Microsoft will [address the issue](https://github.com/microsoft/vscode-jupyter/issues/3998), but I'm not holding my breath. Do let me know if you find a good solution... <!-- TODO the text of 'jupyter server' and 'address the issue' links are for some reason italicized on the hosted web page, no idea why this only affects those links -->
- It's possible for hung ipython kernels to not properly disconnect and clear the GPU. Please make sure there are no (unintentional) jobs left running when you are ready to disconnect. 