# Partner logo sources

Retrieved 2026-11-18. Each SVG was checked to be real SVG (it starts with `<svg` or `<?xml`) and to contain no scripts, external references or embedded images. **No recolouring:** every file here is official artwork, used exactly as the institution publishes it. Files we had recoloured (argonne-white, ucdavis-color, uc-horizontal-color, uc-horizontal-white) were deleted on 2026-11-18. The current `ucdavis-color.png` is a different file: the official Aggie Blue wordmark from UC Davis's own download, added later the same day. Missing variants must come from the institution.

`src/partners.json` names the file the Partner Strip uses for each institution, with the clear-space and minimum-size rules below in machine-readable form. Clear-space ratios there were measured on these files (for example, UIC's "UIC" is 0.32 of the logo's height).

| File | Institution | Format | Size / viewBox | Provenance |
|---|---|---|---|---|
| argonne-color.svg | Argonne National Laboratory | SVG | viewBox 110.9×29.8 (554.5×149) | Copied from `www-ideas/assets/img/logos/argonne.svg` |
| unl-color.svg | Univ. of Nebraska–Lincoln | SVG | viewBox 143.8×92 | Official (N + full name, centred, RGB) |
| unl-white.svg | Univ. of Nebraska–Lincoln | SVG | viewBox 143.8×92 | Official (REV, all white) |
| unl-horizontal-color.svg | Univ. of Nebraska–Lincoln | SVG | viewBox 111.6×36 | Official (N \| NEBRASKA, right, serif, RGB) |
| unl-horizontal-white.svg | Univ. of Nebraska–Lincoln | SVG | viewBox 111.6×36 | Official (REV) |
| ucdavis-color.png | UC Davis | PNG, RGBA, transparent | 3600×623 px | Official 2020 wordmark set, `standard/rgb-png/ucdavis_logo_blue.png`: Aggie Blue `#022851` on transparent, for light backgrounds |
| ucdavis-white.svg | UC Davis | SVG | viewBox 327.16×83.66 | Official site file: extended logo, gold `#febf10` + white, for dark backgrounds |
| uc-color.svg | University of Cincinnati | SVG | viewBox 597.48×268.61 | Official primary logo "on white field" (inline SVG on the brand page) |
| uc-white.svg | University of Cincinnati | SVG | viewBox 597.48×268.61 | Official primary logo "on black field" (red monogram, white text) |
| uc-allwhite.svg | University of Cincinnati | SVG | viewBox 597.48×268.61 | Official primary logo, all white (for red fields) |
| uic-color.png | Univ. of Illinois Chicago | PNG, RGBA, transparent | 1650×600 px | Brand-page preview image of the full-colour logo (includes padding) |
| uic-inverted.png | Univ. of Illinois Chicago | PNG, opaque | 1650×600 px | Brand-page preview: inverted logo **on a navy background baked into the image** |
| uic-white.png | Univ. of Illinois Chicago | PNG, opaque | 1650×600 px | Brand-page preview: white logo **on a navy background baked into the image** |
| kitware-color.svg | Kitware, Inc. | SVG | viewBox 792×245 | Inline header logo from kitware.com (`#0068C7` / `#3EAE2B`) |
| kitware-color.png | Kitware, Inc. | PNG, RGBA, transparent | 2842×730 px | Official press-room high-resolution logo |

## Argonne National Laboratory

- Brand page: https://www.anl.gov/brand (could not be read: Cloudflare challenge, HTTP 403, for both curl and WebFetch)
- Files: the colour file is a local copy of the official SVG. No official reversed file was obtained.
- Usage rules: not retrieved. Check the ANL Communications brand guidance before external use.

## University of Nebraska–Lincoln

- Brand page: https://ucomm.unl.edu/brand/how-use-it/our-marks/ (downloads: https://ucomm.unl.edu/asset-downloads/)
- Direct files:
  - https://ucomm.unl.edu/system/files/2024-12/Nebraska-N-Name.zip
    - `FULL_NAME_2023/RGB HEX/R_Nebraska_N_2023_name_RGB.svg`
    - `FULL_NAME_2023/REV/R_Nebraska_N_2023_name_rev.svg`
    - `NEB_right_2023/RGB HEX/R_Nebraska_N_NEB_2023_right_RGB.svg`
    - `NEB_right_2023/REV/R_Nebraska_N_NEB_2023_right_rev.svg`
  - The same zips also contain AI, EPS, PDF and CMYK/black versions.
- Usage rules:
  - The Nebraska N is the primary identifier and must be used in all visual communication.
  - The full-name lockup is centred only and sans-serif only.
  - Clear space is one inside-serif height of the red N.
  - Minimum height is 0.5 in.
  - Colour is PMS 186CP / HEX `#D00000` / CMYK 2-100-85-6. Black and white are also allowed.
  - Do not recolour, stretch or recreate the N, remove its white outline, or place it on busy backgrounds.
  - The seal is not the campus logo.
  - The page gives no co-branding rules.

## UC Davis

- Brand page: https://communicationsguide.ucdavis.edu/brand-guide/logos/uc-davis-wordmark (blocked by Cloudflare, HTTP 403; read via the Internet Archive snapshot of 2025-11-15)
- Direct files:
  - https://communicationsguide.ucdavis.edu/sites/g/files/dgvnsk6246/files/files/page/UC-Davis-Wordmarks-2020.zip ("Download UC Davis Wordmarks" on the brand page; fetched through the Internet Archive copy of the same URL). `ucdavis-color.png` is `UC_Davis_Wordmarks 2020/standard/rgb-png/ucdavis_logo_blue.png`, unchanged.
  - The zip also has standard and extended wordmarks as EPS (CMYK, PMS and an RGB vector set) and PNGs in blue, gold, black and white. The RGB-vector EPS converts with shifted colours (Aggie Blue comes out about `#1a2a4c`), so the PNG, which carries `#022851` exactly, is used. 3600 px wide is enough for the strip at any slide size. Ask UC Davis Strategic Communications for an official SVG if a vector is needed.
  - https://www.ucdavis.edu/sites/default/files/uc-davis-extended-logo.svg (`ucdavis-white.svg`, gold and white for dark backgrounds; not used in the strip)
- Usage rules:
  - The wordmark is the preferred campus identifier. The extended wordmark ("University of California" beneath) is for when the UC-system association matters especially. The strip uses the standard wordmark.
  - Approved colours: Aggie Blue `#022851`, Aggie Gold `#FFBF00`, black, white, only in the combinations shown (blue on white is one). Never split the wordmark by colour or swap the extended wordmark's colours.
  - Minimum size: the standard wordmark at least 1 in wide for all uses. The extended wordmark at least 1.5 in wide in print and 2 in (150 px) on screen.
  - Clear space: a square equal to the height from the baseline to the top of the initial "U", on every side, including page edges.
  - Use only approved files, scale proportionally, never recreate, distort, add names or graphic elements, or use it as part of a larger mark. Avoid busy backgrounds and poor contrast.
  - Contact: UC Davis Strategic Communications.

## University of Cincinnati

- Brand page: https://www.uc.edu/about/marketing-communications/brand-guide/logos-marks.html (co-brands: .../logos-marks/co-brands.html)
- Direct files: the SVGs are embedded inline in the logos-marks page and were extracted verbatim, with only an XML header added. Official downloadable lockups are on the UC intranet (SharePoint, login required).
- Usage rules:
  - Logo colours:
    - On white or light backgrounds: red monogram (`#e00122`) with black text.
    - On red backgrounds: all white.
    - On dark backgrounds: red monogram with white text.
  - Clear space is the height of the letter "C".
  - The primary logo must not be smaller than 80 px wide (digital) or 0.75 in (print). The secondary logo must not be smaller than 80 px (digital) or 1 in (print).
  - The primary logo is preferred. Use the secondary logo only where the primary won't work.
  - Do not shift elements, recolour, distort, add effects or outlines, or place the logo on complex backgrounds.
  - The horizontal web brandmark is reserved for uc.edu page headers.
  - **Co-branding:**
    - Co-brands must be developed by UC Marketing + Communications, with the UC logo in the leftmost position.
    - Third parties showing affiliation must use language such as "in partnership with".
    - Co-branded assets need explicit approval from the partner and from UC leadership.
    - UC requires partner logos as EPS files with fonts outlined.

## University of Illinois Chicago

- Brand page: https://brand.uic.edu/visual-identity/logos/
- Direct files:
  - https://brand.uic.edu/wp-content/uploads/sites/1284/2025/02/Primary-logo.png
  - https://brand.uic.edu/wp-content/uploads/sites/1284/2025/02/white-logo.png
  - https://brand.uic.edu/wp-content/uploads/sites/1284/2025/02/Inverted-logo.png
- Official vector files (SVG, EPS, PNG) are hosted at https://uic.photoshelter.com/galleries/C0000KL.0Y2CuZ68/Formal-lock-up. The files are `CAMP.HRZ.SM.{RGB,INVT.RBG,WHT.RGB}.svg`. The gallery is public, but downloading the original files needs a PhotoShelter session (API returned 401 "must be logged in"), so we could not download them. Download them manually in a browser and replace the PNGs.
- Usage rules:
  - Colour variants: full colour is preferred, on white or light backgrounds. Inverted keeps the red circle and is for dark backgrounds. White is for mid-to-dark backgrounds or photos. Black is for one-colour use.
  - Clear space equals the height of "UIC" in the circle mark.
  - Do not recolour, outline, stretch, or use the logo with low contrast.
  - Acronym lockups are not allowed.
  - **Co-branding is permitted.** The page shows example cobranded lockups, and logo order depends on which brand is primary or hosting.
  - Contact: smcs@uic.edu.

## Kitware, Inc.

- Brand page: https://www.kitware.com/press-room/
- Direct files:
  - https://www.kitware.com/main/wp-content/uploads/2021/12/Kitware_Logo_HighRes.png
  - SVG extracted from the https://www.kitware.com/ site header
- Other files on the press page: Kitware-Logo-Stacked.png, Kitware-Logo-Tagline.png, Kitware-Mark.png (not copied).
- Usage rules: "Our logo is trademarked. Please contact us for permission to use." (https://www.kitware.com/contact/). No reversed or white version is offered.
