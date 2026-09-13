# Copilot City — third-party visual assets

Every third-party asset shipped with the city is recorded here. Assets are stored locally;
the production experience does not fetch them from a CDN.

| Local file                              | Original work           | Creator                         | Source                                     | License | Changes                                                                                    |
| --------------------------------------- | ----------------------- | ------------------------------- | ------------------------------------------ | ------- | ------------------------------------------------------------------------------------------ |
| `environment/rural_asphalt_road_1k.hdr` | Rural Asphalt Road HDRI | Alexander Scholten / Poly Haven | https://polyhaven.com/a/rural_asphalt_road | CC0 1.0 | Downscaled 1K HDR distribution supplied by Poly Haven; used for image-based lighting only. |
| `vehicles/sedan.glb`                    | Car Kit sedan           | Kenney                          | https://kenney.nl/assets/car-kit           | CC0 1.0 | Renamed, joined, quantized and compressed with Meshopt for street-level use.               |
| `vehicles/suv.glb`                      | Car Kit SUV             | Kenney                          | https://kenney.nl/assets/car-kit           | CC0 1.0 | Renamed, joined, quantized and compressed with Meshopt for street-level use.               |
| `vehicles/taxi.glb`                     | Car Kit taxi            | Kenney                          | https://kenney.nl/assets/car-kit           | CC0 1.0 | Renamed, joined, quantized and compressed with Meshopt for street-level use.               |
| `vehicles/van.glb`                      | Car Kit van             | Kenney                          | https://kenney.nl/assets/car-kit           | CC0 1.0 | Renamed, joined, quantized and compressed with Meshopt for street-level use.               |
| `vehicles/Textures/colormap.png`        | Car Kit colormap        | Kenney                          | https://kenney.nl/assets/car-kit           | CC0 1.0 | Original shared 512 px palette texture referenced by the GLB files.                        |

The procedural buildings, moving vehicle fleets, trees, roads and street furniture are
original project geometry inspired by real urban forms. Kenney's authored cars complement
that system only at street level, where their extra geometry is visible and worthwhile.
