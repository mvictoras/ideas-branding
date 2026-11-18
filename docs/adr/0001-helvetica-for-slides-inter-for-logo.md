# Helvetica for slides; Inter and JetBrains Mono only inside the logo

The Logo and the website use Inter and JetBrains Mono. The Slide Template uses Helvetica, with Consolas (falling back to Courier New) for code. Decks are opened by every Team Member and Partner in PowerPoint (Windows and Mac), Keynote and Google Slides. Most of those machines don't have Inter or JetBrains Mono, so text in those fonts would be silently replaced with a different font and its layout would shift. Helvetica comes with every Mac. Windows PowerPoint and Google Slides automatically show Arial in its place, and Arial has the same character widths, so lines wrap the same way everywhere. The Logo is always placed as an image, so its own fonts are unaffected.

## Considered options

- **Embed Inter and JetBrains Mono in the .pptx**: rejected. Embedding works only in PowerPoint; Keynote and Google Slides ignore embedded fonts.
- **Require the team to install Inter**: rejected. Outside Partners won't do it reliably.
- **Arial only**: workable, but plainer on the Macs most of the team uses.
- **Calibri or Aptos**: Calibri is missing on Macs without Office; Aptos is missing in Keynote, Google Slides and older Office.
