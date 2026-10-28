# De dónde salen las fuentes

IBM Plex, de IBM, bajo la SIL Open Font License 1.1. La licencia es `LICENSE.txt`, la misma de los dos paquetes, y tiene que acompañar siempre a las fuentes.

Son los subconjuntos **Latin1** en woff2 del repositorio oficial ([github.com/IBM/plex](https://github.com/IBM/plex)), bajados de las versiones etiquetadas y sin cambios. Cubren el español completo (á, ñ, ü, ¿, ¡) y la puntuación (·, …, —, comillas). No incluyen flechas como →: el panel las dibuja con íconos SVG.

| Archivo | Paquete y versión | Ruta en el repositorio | SHA-256 |
| --- | --- | --- | --- |
| `IBMPlexSans-Regular-Latin1.woff2` (400) | `@ibm/plex-sans` 1.1.0 | `packages/plex-sans/fonts/split/woff2/` | `b5ad7bd39f996144915f0ad9849a90183b27d8c28ad97ed98af5b1bebc51f6b1` |
| `IBMPlexSans-Medium-Latin1.woff2` (500) | `@ibm/plex-sans` 1.1.0 | `packages/plex-sans/fonts/split/woff2/` | `b5610af04d0d4b5a14a621d96d974b993e945a065db1a8861918f69ef9321934` |
| `IBMPlexSans-SemiBold-Latin1.woff2` (600) | `@ibm/plex-sans` 1.1.0 | `packages/plex-sans/fonts/split/woff2/` | `fff0ab3a88b0b4aa0b693e4f0201359a15183b08e3fa5696d1918d8f0ade8ad5` |
| `IBMPlexSans-Bold-Latin1.woff2` (700) | `@ibm/plex-sans` 1.1.0 | `packages/plex-sans/fonts/split/woff2/` | `914f1400f363e636b6f9cc7965aa807ff01e93586e1437617525cba0a62aa78d` |
| `IBMPlexMono-Regular-Latin1.woff2` (400) | `@ibm/plex-mono` 2.5.0 | `packages/plex-mono/fonts/split/woff2/` | `e8993d946649b9d01abb1ed06d574b19d8ea3e66b5c3948602db335c44c18e56` |
| `IBMPlexMono-Medium-Latin1.woff2` (500) | `@ibm/plex-mono` 2.5.0 | `packages/plex-mono/fonts/split/woff2/` | `41201b658a328b9d00368215c2f1102770f80b15952ab82631e4006255e6365d` |
| `LICENSE.txt` | los dos | `packages/plex-sans/LICENSE.txt` | `7e6b2818edbd8f6a01ae80641cc8f16a51080d08fb4e532be3a0b6f74adb07da` |

**Las direcciones exactas** son `https://raw.githubusercontent.com/IBM/plex/%40ibm%2Fplex-sans%401.1.0/<ruta>` y `https://raw.githubusercontent.com/IBM/plex/%40ibm%2Fplex-mono%402.5.0/<ruta>`. Cada archivo coincide con el de la rama `master` del 28 de octubre de 2026.

**Si hace falta otra fuente o un peso nuevo:**
1. Bajalo del mismo lugar, sin cambiarlo.
2. Sumá su `@font-face` en `estilos.css`.
3. Agregá su fila en esta tabla.

`herramientas/verificar.mjs` compara cada hash.
