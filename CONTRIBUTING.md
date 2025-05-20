# Contributing to NEXT-EVAL

Thank you for considering contributing to our project! We welcome contributions from the community and are excited to collaborate with you. This document outlines how you can contribute effectively.

## Table of Contents

* [Code of Conduct](#code-of-conduct)
* [How Can I Contribute?](#how-can-i-contribute)
    * [Reporting Bugs](#reporting-bugs)
    * [Suggesting Enhancements](#suggesting-enhancements)
    * [Your First Code Contribution](#your-first-code-contribution)
    * [Pull Requests](#pull-requests)
* [Style Guides](#style-guides)
    * [Git Commit Messages](#git-commit-messages)
    * [Python Styleguide](#python-styleguide)
* [Setting up Your Development Environment](#setting-up-your-development-environment)
* [Questions?](#questions)

## Code of Conduct

This project and everyone participating in it is governed by the [NEXT-EVAL Code of Conduct](CODE_OF_CONDUCT.md) (You'll need to create this file, often based on the Contributor Covenant). By participating, you are expected to uphold this code. Please report unacceptable behavior.

## How Can I Contribute?

### Reporting Bugs

If you encounter a bug, please help us by reporting it. Good bug reports are extremely helpful!

Before submitting a bug report, please:
* **Check the documentation:** You might find that the behavior is intended or there's a known workaround.
* **Search existing issues:** Someone else might have already reported the same bug. If so, you can add any new information to the existing issue.

When submitting a bug report, please include the following:
* **A clear and descriptive title.**
* **A detailed description of the problem:**
    * What did you do?
    * What did you expect to happen?
    * What actually happened? (Include any error messages and stack traces)
* **Steps to reproduce the bug:** Provide a minimal, reproducible example if possible.
* **Your environment:**
    * Operating System and version
    * Python version
    * NEXT-EVAL version (if applicable, or commit hash)
    * Any other relevant dependencies or environment details.
* **Screenshots or logs** if they help illustrate the problem.

File bug reports as [GitHub Issues](https://github.com/wordbricks/next-eval/issues).

### Suggesting Enhancements

We welcome suggestions for new features or improvements to existing functionality.

When submitting an enhancement suggestion, please include:
* **A clear and descriptive title.**
* **A detailed description of the proposed enhancement:**
    * What is the problem you're trying to solve?
    * How would this enhancement address it?
    * Are there any alternative solutions or features you've considered?
* **Mockups or examples** if they help illustrate the enhancement.
* **Why this enhancement would be useful** to other NEXT-EVAL users.

File enhancement suggestions as [GitHub Issues](https://github.com/wordbricks/next-eval/issues), clearly labeling them as "enhancement" or "feature request."

### Pull Requests

We use GitHub Pull Requests to manage code contributions.

1.  **Fork the repository** to your own GitHub account.
2.  **Clone your fork** locally: `git clone https://github.com/wordbricks/next-eval.git`
3.  **Create a new branch** for your changes: `git checkout -b feature/your-feature-name` or `fix/bug-description`.
4.  **Make your changes.** Ensure you:
    * Follow the [Style Guides](#style-guides).
    * Write clear, concise, and well-commented code.
    * Add or update unit tests for your changes. Ensure all tests pass.
    * Update documentation if your changes affect it.
5.  **Commit your changes** with a descriptive commit message (see [Git Commit Messages](#git-commit-messages)).
6.  **Push your branch** to your fork: `git push origin feature/your-feature-name`.
7.  **Open a Pull Request (PR)** from your fork's branch to the `main` (or `develop`) branch of the original NEXT-EVAL repository.
    * Provide a clear title and a detailed description of your changes in the PR.
    * Reference any relevant issues (e.g., "Fixes #123").
    * Ensure your PR passes all automated checks (linters, tests).
8.  **Engage in the PR review process.** Be prepared to discuss your changes and make further modifications if requested by the maintainers.

## Style Guides

### Git Commit Messages

* Use the present tense ("Add feature" not "Added feature").
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...").
* Limit the first line to 72 characters or less.
* Reference issues and pull requests liberally after the first line.
* Consider using [Conventional Commits](https://www.conventionalcommits.org/) for more structured messages, e.g.:
    * `feat: Add new HTML to FlatJSON conversion option`
    * `fix: Correct XPath generation in hierarchical JSON`
    * `docs: Update installation guide`
    * `test: Add unit tests for scoring engine`

### Python Styleguide

* Follow [PEP 8 -- Style Guide for Python Code](https://www.python.org/dev/peps/pep-0008/).
* Use a linter like Flake8 or Pylint to check your code.
* Format your code using a tool like Black or autopep8.
* Write clear and concise docstrings for all modules, classes, functions, and methods, following [PEP 257 -- Docstring Conventions](https://www.python.org/dev/peps/pep-0257/).


## Setting up Your Development Environment

Please refer to the [Installation Guide](README.md#-getting-started)  in the main README and any specific instructions in `docs/developer_setup.md` for details on setting up your development environment, including installing dependencies and any necessary tools.

## Questions?

If you have questions about contributing, feel free to:
* Open an issue on GitHub and tag it as "question."
* feel free to send us an email at research@wordbricks.ai

Thank you for your interest in contributing to NEXT-EVAL!
