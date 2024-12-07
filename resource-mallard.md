---
title: Mallard SOP
---

Mallard is the group's first GPU server with 4 Nvidia L40s GPUs, 64 cores, 128 threads, and 512 GB RAM. 

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

## Allocating CPUs on mallard

Some packages (`torch`, `abtem`, `ase`, `construction_zone`, ...) may potentially allocate all available [threads](https://www.liquidweb.com/blog/difference-cpu-cores-thread/#h-the-difference-between-cores-vs-threads) which could become problematic performance-wise as mallard is a *shared* server. Unless the script/notebook that is running has intentional multi-processing/multi-threading capabilities, it is good practice to instantiate the following at the top of your script or notebook:

```python
import os
os.environ["OMP_NUM_THREADS"] = "N" # Change N to required number of threads, 
                                    # often N=1 is sufficient for most workloads.
```

The use cases of multi-processing or multi-threading is dependent on the specific needs of the project. And often before pursuing either options, it is advised to ask someone if there are no other optimizations to be made to boost performance. Here are a few situations where increasing `N` to be greater than 1 makes sense, and should be avoided:

1. `abtem` / `ase` / `construction_zone`
    - When using these packages one should **always** limit their threads to `N=1`. These packages will always allocate all available CPU cores without substantial performance gains. 
    - Simulating nanoparticles does not require fast I/O operations, but does the bulk of the work on the specified GPU.

2. `torch`
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