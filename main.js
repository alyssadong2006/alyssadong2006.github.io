const year = document.getElementById("current-year");

if (year) {
  year.textContent = String(new Date().getFullYear());
}

const soundToggle = document.getElementById("sound-toggle");
const soundStatus = document.getElementById("sound-status");
const audio = document.querySelector("#bgmusic, #bgmusicTwo");
const soundName = "ocean";

if (soundToggle && soundStatus && audio) {
  const setSoundButtonLabel = (playing) => {
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "♫";
    soundToggle.replaceChildren(
      document.createTextNode(`${playing ? "Pause" : "Play"} ${soundName} sounds `),
      icon,
    );
    soundToggle.setAttribute("aria-pressed", String(playing));
  };

  soundToggle.addEventListener("click", async () => {
    if (!audio.paused) {
      audio.pause();
      setSoundButtonLabel(false);
      soundStatus.textContent = "Sound off.";
      return;
    }

    try {
      await audio.play();
      setSoundButtonLabel(true);
      soundStatus.textContent = "Sound on.";
    } catch (error) {
      setSoundButtonLabel(false);
      soundStatus.textContent = error instanceof DOMException && error.name === "NotAllowedError"
        ? "Your browser blocked audio. Try clicking Play again."
        : "Ocean sounds could not play. Check that media/waves.mp3 is available and try again.";
    }
  });

  audio.addEventListener("error", () => {
    soundStatus.textContent = "The sound file could not be loaded.";
  });
}

const gameWorld = document.querySelector(".game-world, .projects-page");
const gameStatus = document.getElementById("game-status");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (gameWorld && gameStatus) {
  const glitches = [];
  const glitchMessages = ["404: snack not found", "A wild pixel appeared!", "Quest accepted!", "Tiny bug, big adventure!", "You found a secret!"];

  gameWorld.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || event.target.closest("a, button, input, textarea, select, summary, audio, .experience-card, .project-card, .skill-card, .education-card")) {
      return;
    }

    const glitch = document.createElement("span");
    glitch.className = "game-glitch";
    glitch.setAttribute("aria-hidden", "true");
    glitch.textContent = glitchMessages[Math.floor(Math.random() * glitchMessages.length)];
    gameWorld.append(glitch);

    const left = Math.min(event.clientX, window.innerWidth - 220);
    const top = Math.min(event.clientY, window.innerHeight - 80);
    glitch.style.left = `${Math.max(8, left)}px`;
    glitch.style.top = `${Math.max(8, top)}px`;

    glitches.push(glitch);
    if (glitches.length > 8) {
      glitches.shift().remove();
    }

    gameStatus.textContent = glitch.textContent;
    window.setTimeout(() => {
      glitch.remove();
      const index = glitches.indexOf(glitch);
      if (index >= 0) glitches.splice(index, 1);
    }, 1400);
  });
}

if (!reducedMotion.matches && window.matchMedia("(pointer: fine)").matches) {
  let lastSparkle = 0;
  document.addEventListener("pointermove", (event) => {
    const now = performance.now();
    if (now - lastSparkle < 90) return;
    lastSparkle = now;

    const sparkle = document.createElement("span");
    sparkle.className = "sparkle";
    sparkle.setAttribute("aria-hidden", "true");
    sparkle.style.left = `${event.clientX}px`;
    sparkle.style.top = `${event.clientY}px`;
    document.body.append(sparkle);
    window.setTimeout(() => sparkle.remove(), 700);
  });
}
