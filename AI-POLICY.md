# AI usage policy

OGL is built with a lot of help from AI tools, and contributions made with them are welcome. This page says what is expected when you use them here.

The short version: an AI tool can write the change, but a person has to stand behind it.

## A person is responsible for every change

If you send a pull request, you should understand it. You should be able to say what the change does, why it is needed, and how it fits the code around it, without asking the tool to explain it for you.

Code that compiles and passes the tests is not automatically right. Read it, run it, and try it in the app before you submit it.

## Game files need a real check

Most contributions to OGL are catalog files in `catalog/games`. Those decide which file OGL downloads and which program it starts on a player's computer, so they need more care than they look like they do.

If an AI tool helped write a game file, check by hand that:

- the repository, website and image links exist and belong to the game
- the game installs and starts from OGL on at least one system
- the description says what the game is, not what a model guessed it is

AI tools invent repository names and download links that look plausible. A game file that was never tried will be closed.

## Say when AI did the work

If an AI tool wrote a substantial part of your contribution, mention it in the pull request. One line is enough:

> Written with Claude Code. I reviewed the changes and tested the install on Windows.

You do not need to mention autocomplete, spelling and grammar fixes, formatting, or asking a tool a general question.

This is for transparency. It does not count against the contribution.

## Issues and comments

You can use AI tools to help write an issue or a comment. Read it before you post it, cut it down to what matters, and make sure it is true.

Please do not paste long, unreviewed AI output. Someone has to read it, and on this project that someone is one person in their spare time.

## How the maintainer uses AI

OGL itself is written largely with AI tools: code, tests, documentation and the release setup. The maintainer decides what gets built, reviews the result, tests it, and is responsible for what ships.

## Low-effort contributions

A tool can produce code and text in seconds. Reviewing it still takes a person real time. Pull requests and issues that were clearly generated and never checked may be closed without a detailed reply.

Good contributions are welcome, whether or not AI helped make them.

## Acknowledgements

This policy is adapted from the [OpenSC2K AI usage policy](https://github.com/nicholas-ochoa/OpenSC2K/blob/main/AI-POLICY.md), which in turn builds on the [Ghostty AI usage policy](https://github.com/ghostty-org/ghostty/blob/main/AI_POLICY.md). Thanks to both projects for publishing theirs.
