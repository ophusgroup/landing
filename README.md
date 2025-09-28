# Colin Ophus Lab – Group Website Repository

## Table of Contents

1. [How to update the website as a new contributor (Tutorial 1/2)](#how-to-update-the-website-as-a-new-contributor-tutorial-12)
    1. [Step 1. Fork and clone the repository to your computer](#step-1-fork-and-clone-the-repository-to-your-computer)
    1. [Step 2. Update files locally and push changes to your remote origin](#step-2-update-files-locally-and-push-changes-to-your-remote-origin)
    1. [Step 3. Create a pull request to update the original repository](#step-3-create-a-pull-request-to-update-the-original-repository)
1. [How to update the website after syncing the latest changes (Tutorial 2/2)](#how-to-update-the-website-after-syncing-the-latest-changes-tutorial-22)
1. [For maintainers](#for-maintainers)
    1. [How to run the website locally](#how-to-run-the-website-locally)
    1. [How to deploy the website](#how-to-deploy-the-website)
    1. [Resources](#resources)

If you have any questions, please don't hesitate to reach out to @bobleesj.

## How to update the website as a new contributor (Tutorial 1/2)

### Step 1. Fork and clone the repository to your computer

1. Fork this repository by clicking the `Fork` button on [https://github.com/ophusgroup/landing](https://github.com/ophusgroup/landing). This will create a new repository under your account at `https://github.com/<your-username>/landing`.
1. Open your terminal window.
1. Clone your forked repository to your local machine by running:
    ```
    git clone https://github.com/<your-username>/landing
    ```
    The term `origin` refers to the forked repository on GitHub. "Clone" essentially downloads the `origin` repository in the cloud to your local machine.
1. Verify that the `origin` remote is connected by running:
    ```
    git remote -v
    ```
    The term `remote` refers to the repository hosted on GitHub, it could be `https://github.com/ophusgroup/landing` or `https://github.com/<your-username>/landing`

### Step 2. Update files locally and push changes to your remote `origin`

1. Run `git branch` to see which branch you are currently on. You should be on the `main` branch. In general, avoid making direct updates to `main`, as it is considered the "final" version.
1. Create a new branch based on `main` by running:
    ```
    git checkout -b <branch-name>
    ```
1. Open your preferred IDE (e.g., Visual Studio Code) and edit the files as needed.
1. After making changes, run `git status` to see which files have been modified.
1. Stage the changes by running:
    ```
    git add <file-or-folder-modified>
    ```
    You can add multiple files or folders at once if needed.
1. Commit your changes with a clear and concise message, for example:
    ```
    git commit -m "Add John Doe to people section"
    ```
1. Push your branch to your forked repository on GitHub:
    ```
    git push --set-upstream origin <branch-name>
    ```
    Visit your forked repository URL to confirm the changes have been uploaded.

### Step 3. Create a pull request to update the original repository

1. Go to [https://github.com/ophusgroup/landing](https://github.com/ophusgroup/landing) and click the green `Compare & pull request` button.
1. Create a pull request from your branch to the `main` branch of the original repository (`ophusgroup/main`) from `<your-username>/<branch-name>`.
1. Write a concise title for your pull request, such as "Add John Doe as a new member," and submit the PR.
1. Tag a reviewer for your pull request.
1. Wait for your pull request to be reviewed and merged.
1. Once merged, congratulations! The website will be automatically updated.

## How to update the website after syncing the latest changes (Tutorial 2/2)

It is assumed that you have already completed the first tutorial above. First, we want to sync with the latest changes from the original repository.

1. Add the `upstream` repository, which refers to https://github.com/ophusgroup/landing, by running:
    ```
    git remote add upstream https://github.com/ophusgroup/landing
    ```
2. Type `git remote -v` to check that you have both `origin` and `upstream` listed.
3. Run `git checkout main` to switch to the `main` branch of the repository in your local machine.
4. Run `git pull upstream main` to pull the latest commits/changes from the `upstream` repository where other people may have contributed.
5. Run `git checkout -b <another-branch-name>` and start editing files.
6. Run `git add <file-or-folder-modified>` and `git commit -m "<commit-message>"`, then finally:
    ```
    git push --set-upstream origin <another-branch-name>
    ```
    to upload the changes to your `origin` forked repository on GitHub.
7. Visit [https://github.com/ophusgroup/landing](https://github.com/ophusgroup/landing), make a pull request, and wait for it to be reviewed and merged.

## For maintainers

### How to run the website locally

1. Activate the relevant conda environment in your terminal window.
2. Fork this repository and clone your fork.
3. Run `npm install -g curvenote` to install Curvenote.
4. Run `curvenote start` to start the server.

### How to deploy the website

1. When a new commit is made to the `main` branch, a GitHub Action will automatically run and deploy the changes.

### Resources

1. [Curvenote GitHub Repository](https://github.com/curvenote/curvenote)
2. [MyST Markdown Quickstart Guide](https://mystmd.org/guide/quickstart)
