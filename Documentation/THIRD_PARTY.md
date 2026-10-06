# Third-party data and code

## free-exercise-db (exercise metadata and photos)
- Source: https://github.com/yuhonas/free-exercise-db, pinned at commit `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5`.
- License: The Unlicense (public domain dedication). Its upstream, https://github.com/wrkout/exercises.json, is also Unlicense and describes the data and imagery as public domain.
- Use: names, muscles, equipment and instructions are mapped into the owner's exercise catalog by `scripts/seed-exercise-catalog.mjs` / `src/domain/exercise-catalog.ts`. Photos are never stored in this repository or in our storage: the app loads them from jsDelivr (`https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@<commit>/exercises/...`).
- Caveat: we have not independently verified the origin of the photographs; the authors' public-domain statement is relied upon. The app is a personal tool; remove `exercises.images` entries if a rights holder objects.

## hasaneyldrm/exercises-dataset (retired)
- Metadata and text only (MIT). Its images, GIFs and videos belong to Gym visual and were never imported. The catalog rows seeded from it were replaced by free-exercise-db on 2026-10-06.

## react-native-body-highlighter (muscle map outline)
- Source: https://github.com/HichamELBSI/react-native-body-highlighter (male body, `assets/bodyFront.ts` / `bodyBack.ts`). License: MIT; the full notice and pinned commit are in the header of `android/.../ui/workout/BodyMapData.kt`.
- Use: `scripts/generate-body-map.mjs` converts the SVG paths once into the generated Kotlin file; `MuscleMap.kt` draws them and highlights the worked muscles. Nothing is fetched at runtime.
