# Sequential--Interaction--project
Code respository for IXD 107 project 2 working with claude code

## Live page

https://xiyanzhangava.github.io/Sequential--Interaction--project/

## Mystery Room prototype

The sequential prototype lives in [`/docs`](docs/) (static site for GitHub Pages: `index.html`, `style.css`, `script.js`, empty `.nojekyll`). It combines the three studies in the ZIPs at the repo root (`reveal-the-clue.zip`, `reveal-the-mirror-clue.zip`, `unlock-the-door.zip`), which are left untouched.

Sequence: find the envelope -> read the paper -> wipe the mirror -> enter the 4-digit code at the door.

The code is the paper's two digits followed by the mirror's two digits. The digits are **placeholders** set at the top of `docs/script.js` (`CONFIG.PAPER_DIGITS`, `CONFIG.MIRROR_DIGITS`).

To publish: repo Settings -> Pages -> Deploy from branch -> `main` / `/docs`.
