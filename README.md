# Arendal-museet

Et 3D fotomuseum der du går rundt i en hvit sørlandskirke og ser historiske fotografier av Arendal, hentet fra Nasjonalbibliotekets åpne API.

76 public domain-bilder er organisert i tre saler etter tidsperiode (før 1905, 1905–1949, etter 1950), gruppert på veggene etter kategori: havn og sjøfart, kirke og Tyholmen, gater og bygninger, byen og utsikt, og mennesker.

## Forutsetninger

- Node.js 18 eller nyere
- npm

## Installasjon og oppstart

```bash
# Installer avhengigheter
npm install

# Last ned bilder fra Nasjonalbiblioteket (tar 3–5 minutter første gang)
npm run fetch-data

# Start dev-serveren
npm run dev
```

Åpne http://localhost:5173 i nettleseren.

`npm run fetch-data` er idempotent — den hopper over bilder som allerede er lastet ned, så du kan trygt kjøre den igjen.

## Kontroller

- **WASD / piltaster** — gå
- **Mus** — se deg rundt
- **E / klikk** — se nærmere på et bilde
- **Esc** — meny / lukk bildevisning

## Tech stack

- **Three.js** — 3D-motor (prosedyralt generert geometri, ingen eksterne 3D-modeller)
- **Vite** — bundler og dev-server
- **Nasjonalbibliotekets API** (api.nb.no) — bildekilde via IIIF Image API

## Bildene

Alle fotografier er i public domain og lastes ned fra Nasjonalbiblioteket. Klikk på et bilde i museet for å se metadata og lenke til originalen på nb.no.
