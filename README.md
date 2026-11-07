# Alyssa Dong's Portfolio

A framework-free static portfolio for my software engineering experience, projects, skills, and education.

- `index.html` is the home page and resume-focused introduction.
- `projects.html` presents selected projects with interactive category filters.
- The pastel pixel-art theme includes an animated beach, optional page-specific sound, cursor sparkles, and playful click effects. Sound starts only after opting in, and decorative motion respects reduced-motion preferences.

The homepage includes an original procedural Three.js beach diorama (`beach-3d.js` and `beach-3d.css`). Three.js 0.160.1 is vendored in `vendor/` with its MIT licence; no external models, textures, or runtime CDN requests are needed. The scene pauses offscreen and in hidden tabs, respects reduced motion, and has a static fallback when WebGL is unavailable.

Click the beach frame (or focus it and press Enter/Space) to switch the whole page between consistent pixel and 3D themes. The default pixel world has blocky typography, flat UI, a low-resolution orthographic beach picture with a stepped mouse-driven orbit and tilt, and pixel-art flowers and vines. The 3D world has bubbly controls, a closer smooth perspective beach picture with shaded garden decorations and an eased mouse-driven orbit (wider yaw and vertical tilt, disabled for reduced motion), and a full-screen procedural beach (`ocean-world.js`): animated ocean geometry, rolling foam, shaded clouds, sunlight, shells, and sea glass. The 3D layout is mostly open, with translucent experience/project cards rather than opaque background boxes.

`theme-switch.js` uses a radial SVG displacement map to visibly bend text and controls along the circular View Transition reveal. Reduced motion switches instantly; browsers without View Transitions still get a temporary displacement ripple. `daylight-theme.css` styles both dimensions. The theme follows navigation within the current tab via optional session storage; the floating theme button also works on the projects page. The background initializes only when needed and pauses in the pixel world or a hidden tab. WebGL failure leaves a CSS beach-colour fallback. Pixelify Sans is bundled locally in `media/` with its OFL licence in `vendor/`. The 3D world uses bubbly Fredoka headings, Quicksand controls, and Nunito body text (`cute-daylight.css`), all bundled locally with OFL licences, alongside warm pastel surfaces and softly coloured lighting. `sunflower-trail.js` adds a bounded cursor garden only for a mouse in the 3D world: 44–58px sunflowers with two petal rings and textured centres open, linger, and slowly fold back before fading. Flower centres are spaced 80px apart by cursor distance, rather than time or pointer-event frequency; larger jumps are interpolated with bounded per-event work. The trail clears on theme changes, reduced motion, and hidden tabs.

The experience and education sections use unmodified official employer and University of Waterloo logos, saved locally. Sources and trademark attribution are documented in `media/company-logo-sources.md`; `company-logos.css` keeps them legible in both themes.

Run a local HTTP server (ES modules require HTTP rather than opening the file directly):

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Then visit http://localhost:8000. No build or dependency installation is required.
