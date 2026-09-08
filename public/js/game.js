// Port of src/Stranice/Igraj.tsx (React) na vanilla JS + Laravel API pozive.
(function () {
  const cfg = window.CATAN_CONFIG;

  const hexLayout = [3, 4, 5, 4, 3];
  const resourceLimits = { pustinja: 1, drvo: 4, ovca: 4, psenica: 4, cigla: 3, kamen: 3 };
  const resourceEmojis = { pustinja: "🏜", drvo: "🌲", ovca: "🐑", psenica: "🌾", cigla: "🧱", kamen: "🪨" };
  const resourceImages = {
    pustinja: `${cfg.imagesBase}/pustinja.png`,
    drvo: `${cfg.imagesBase}/drvo.png`,
    ovca: `${cfg.imagesBase}/ovca.png`,
    psenica: `${cfg.imagesBase}/psenica.png`,
    cigla: `${cfg.imagesBase}/cigla.png`,
    kamen: `${cfg.imagesBase}/kamen.png`,
  };

  const numberTokens = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];
  const outerRing = [0, 1, 2, 6, 11, 15, 18, 17, 16, 12, 7, 3];
  const innerRing = [4, 5, 10, 14, 13, 8];
  const center = 9;
  const cornerIndices = [0, 2, 11, 18, 16, 7];

  const tromedje = [
    [0, 1, 4], [1, 2, 5], [2, 5, 6],
    [0, 3, 4], [1, 4, 5],
    [3, 4, 8], [3, 7, 8], [4, 5, 9],
    [4, 8, 9], [5, 6, 10], [5, 9, 10],
    [6, 10, 11],
    [7, 8, 12], [8, 12, 13], [8, 9, 13],
    [9, 13, 14], [9, 10, 14],
    [10, 14, 15], [10, 11, 15],
    [12, 13, 16], [13, 16, 17], [13, 14, 17],
    [14, 17, 18], [14, 15, 18],
  ];

  let state = {
    tiles: Array(19).fill(null),
    counts: Object.fromEntries(Object.keys(resourceLimits).map((r) => [r, 0])),
    numbers: Array(19).fill(null),
    rolled: null,
    started: false,
    players: [
      { id: 1, name: "Igrač 1", resources: { drvo: 0, ovca: 0, psenica: 0, cigla: 0, kamen: 0 } },
      { id: 2, name: "Igrač 2", resources: { drvo: 0, ovca: 0, psenica: 0, cigla: 0, kamen: 0 } },
    ],
    log: [],
    playerTromedje: [],
    gameId: null,
  };

  function rollOneDie() {
    return Math.floor(Math.random() * 6) + 1;
  }

  async function apiFetch(path, options = {}) {
    const res = await fetch(`${cfg.apiBase}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": cfg.csrfToken,
        Accept: "application/json",
        ...(options.headers || {}),
      },
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  }

  function renderBoard() {
    const boardEl = document.getElementById("board");
    boardEl.innerHTML = "";
    let counter = 0;

    hexLayout.forEach((count) => {
      const row = document.createElement("div");
      row.className = "row";
      for (let i = 0; i < count; i++) {
        const idx = counter++;
        const owner = state.playerTromedje.find((t) => t.fields.includes(idx));
        const ownerClass = owner ? `owned player-${owner.id}` : "";

        const hex = document.createElement("div");
        hex.className = `hex ${ownerClass}`;

        if (state.tiles[idx]) {
          const img = document.createElement("img");
          img.src = resourceImages[state.tiles[idx]];
          img.alt = state.tiles[idx];
          hex.appendChild(img);
          if (state.numbers[idx]) {
            const numDiv = document.createElement("div");
            numDiv.className = "number";
            numDiv.textContent = state.numbers[idx];
            hex.appendChild(numDiv);
          }
        } else {
          const grid = document.createElement("div");
          grid.className = "options-grid";
          Object.keys(resourceLimits).forEach((res) => {
            const btn = document.createElement("button");
            btn.textContent = resourceEmojis[res];
            btn.onclick = () => handleSelect(idx, res);
            grid.appendChild(btn);
          });
          hex.appendChild(grid);
        }

        row.appendChild(hex);
      }
      boardEl.appendChild(row);
    });
  }

  function handleSelect(idx, res) {
    if (state.tiles[idx]) return;
    if (state.counts[res] >= resourceLimits[res]) {
      alert(`Nema više ${res}`);
      return;
    }
    state.tiles[idx] = res;
    state.counts[res] += 1;
    renderBoard();
  }

  function rollDiceAndAssign() {
    if (state.tiles.includes(null)) return alert("Popuni sva polja!");
    const dice = rollOneDie();
    state.rolled = dice;
    document.getElementById("setup-roll-result").textContent = `Pao broj: ${dice}`;

    const startCorner = cornerIndices[dice - 1];
    const startOuterIdx = outerRing.indexOf(startCorner);
    const rotatedOuter = outerRing.slice(startOuterIdx).concat(outerRing.slice(0, startOuterIdx));

    let numIndex = 0;
    const newNumbers = Array(19).fill(null);
    rotatedOuter.forEach((idx) => {
      if (state.tiles[idx] !== "pustinja") newNumbers[idx] = numberTokens[numIndex++];
    });

    const rotatedInner = innerRing.concat(innerRing).slice(dice % 6, (dice % 6) + 6);
    rotatedInner.forEach((idx) => {
      if (state.tiles[idx] !== "pustinja") newNumbers[idx] = numberTokens[numIndex++];
    });
    if (state.tiles[center] !== "pustinja") newNumbers[center] = numberTokens[numIndex++];

    state.numbers = newNumbers;
    renderBoard();
  }

  async function startGame() {
    const allAssigned = state.tiles.every((tile, idx) => tile === "pustinja" || state.numbers[idx] !== null);
    if (!allAssigned) return alert("Prvo dodeli brojeve!");

    const shuffled = [...tromedje].sort(() => Math.random() - 0.5);
    const chosen = [];
    for (let pid = 1; pid <= state.players.length; pid++) {
      let playerT = [];
      for (let i = 0; i < 2; i++) {
        const candidate = shuffled.find((tri) => {
          const overlapSelf = playerT.some((t) => t.some((f) => tri.includes(f)));
          const overlapOthers = chosen.some((ch) => ch.fields.some((f) => tri.includes(f)));
          return !overlapSelf && !overlapOthers;
        });
        if (candidate) {
          playerT.push(candidate);
          shuffled.splice(shuffled.indexOf(candidate), 1);
        }
      }
      playerT.forEach((tri) => chosen.push({ id: pid, fields: tri }));
    }
    state.playerTromedje = chosen;
    state.log = [...chosen.map((o) => `Igrač ${o.id}: ${JSON.stringify(o.fields)}`), ...state.log].slice(0, 4);
    state.started = true;

    document.getElementById("setup-controls").style.display = "none";
    document.getElementById("game-controls").style.display = "block";
    renderPlayers();
    renderLog();
    renderBoard();

    // Kreiraj partiju na backendu (POST /api/games)
    try {
      const game = await apiFetch("/games", {
        method: "POST",
        body: JSON.stringify({ board_state: { tiles: state.tiles, numbers: state.numbers, playerTromedje: state.playerTromedje } }),
      });
      state.gameId = game.id;
    } catch (e) {
      console.warn("Nije moguće kreirati partiju na serveru:", e);
    }
  }

  async function rollGameDice() {
    const diceIcon = document.getElementById("dice-icon");
    diceIcon.classList.add("dice-shake");
    setTimeout(() => diceIcon.classList.remove("dice-shake"), 500);

    let dice;
    try {
      // POST /api/games/{id}/roll -> backend zove javni dice API i cuva log
      const result = state.gameId
        ? await apiFetch(`/games/${state.gameId}/roll`, { method: "POST" })
        : null;
      dice = result ? result.roll : rollOneDie() + rollOneDie();
      if (result) state.log = result.log;
    } catch (e) {
      dice = rollOneDie() + rollOneDie();
      state.log = [`Dobijen je broj ${dice}`, ...state.log].slice(0, 4);
    }

    state.rolled = dice;

    state.players = state.players.map((p) => {
      const upd = { ...p, resources: { ...p.resources } };
      const troms = state.playerTromedje.filter((t) => t.id === p.id);
      troms.forEach((trom) => {
        trom.fields.forEach((idx) => {
          if (state.numbers[idx] === dice && state.tiles[idx] && state.tiles[idx] !== "pustinja") {
            upd.resources[state.tiles[idx]] += 1;
          }
        });
      });
      return upd;
    });

    renderPlayers();
    renderLog();
  }

  function renderPlayers() {
    const el = document.getElementById("player-info");
    el.innerHTML = "";
    state.players.forEach((p) => {
      const box = document.createElement("div");
      box.className = "player-box";
      box.innerHTML = `<h3 style="margin:0">${p.name}</h3>
        <p>🌲 ${p.resources.drvo} 🐑 ${p.resources.ovca} 🌾 ${p.resources.psenica} 🧱 ${p.resources.cigla} 🪨 ${p.resources.kamen}</p>`;
      el.appendChild(box);
    });
  }

  function renderLog() {
    const el = document.getElementById("roll-log-list");
    el.innerHTML = "";
    state.log.forEach((entry) => {
      const li = document.createElement("li");
      li.textContent = entry;
      el.appendChild(li);
    });
  }

  async function saveGame() {
    if (!state.gameId) return alert("Prvo pokreni partiju (Počni igru).");
    try {
      await apiFetch(`/games/${state.gameId}`, {
        method: "PUT",
        body: JSON.stringify({ board_state: { tiles: state.tiles, numbers: state.numbers, playerTromedje: state.playerTromedje, players: state.players, log: state.log } }),
      });
      alert("✅ Partija sačuvana.");
    } catch (e) {
      alert("❌ Greška pri čuvanju.");
    }
  }

  async function loadGame() {
    if (!state.gameId) return alert("Nema aktivne partije za učitavanje.");
    try {
      const game = await apiFetch(`/games/${state.gameId}`);
      const bs = game.board_state || {};
      state.tiles = bs.tiles || state.tiles;
      state.numbers = bs.numbers || state.numbers;
      state.playerTromedje = bs.playerTromedje || state.playerTromedje;
      state.players = bs.players || state.players;
      state.log = bs.log || state.log;
      renderBoard();
      renderPlayers();
      renderLog();
      alert("✅ Partija učitana.");
    } catch (e) {
      alert("❌ Greška pri učitavanju.");
    }
  }

  function resetGame() {
    if (!window.confirm("Reset partiju?")) return;
    state = {
      tiles: Array(19).fill(null),
      counts: Object.fromEntries(Object.keys(resourceLimits).map((r) => [r, 0])),
      numbers: Array(19).fill(null),
      rolled: null,
      started: false,
      players: state.players.map((p) => ({ ...p, resources: { drvo: 0, ovca: 0, psenica: 0, cigla: 0, kamen: 0 } })),
      log: [],
      playerTromedje: [],
      gameId: null,
    };
    document.getElementById("setup-controls").style.display = "block";
    document.getElementById("game-controls").style.display = "none";
    document.getElementById("setup-roll-result").textContent = "";
    renderBoard();
  }

  document.getElementById("btn-roll-setup").addEventListener("click", rollDiceAndAssign);
  document.getElementById("btn-start-game").addEventListener("click", startGame);
  document.getElementById("dice-icon").addEventListener("click", rollGameDice);
  document.getElementById("btn-finish-game").addEventListener("click", () => {
    resetGame();
    window.location.href = "/";
  });
  document.getElementById("btn-save").addEventListener("click", saveGame);
  document.getElementById("btn-load").addEventListener("click", loadGame);
  document.getElementById("btn-reset").addEventListener("click", resetGame);

  renderBoard();
})();
