// Port of src/Stranice/Igraj.tsx (React) na vanilla JS + Laravel API pozive.
// IZMENA: igrac sam bira tromedju (teren) na kojoj hoce da bude, umesto da mu se
// nasumicno dodeli. "Pocni igru" samo prikaze/potvrdi ono sto je vec izabrano.
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

  // Master lista svih moguca 24 "tromedja" (mesta za naselje) - svaka je niz od 3 indeksa polja koja dodiruje.
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
    // faze: 'tiles' -> 'numbers' -> 'picking' -> 'ready' -> 'playing'
    phase: "tiles",
    tiles: Array(19).fill(null),
    counts: Object.fromEntries(Object.keys(resourceLimits).map((r) => [r, 0])),
    numbers: Array(19).fill(null),
    rolled: null,
    players: [
      { id: 1, name: "Igrač 1", resources: { drvo: 0, ovca: 0, psenica: 0, cigla: 0, kamen: 0 } },
      { id: 2, name: "Igrač 2", resources: { drvo: 0, ovca: 0, psenica: 0, cigla: 0, kamen: 0 } },
    ],
    log: [],
    playerTromedje: [], // { id, fields } - popunjava se klikom igraca tokom 'picking' faze
    pickOrder: [],       // niz id-jeva igraca u "zmija" redosledu, npr [1,2,2,1]
    currentPickIndex: 0,
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
    if (state.phase !== "tiles") return;
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

    // Nakon dodele brojeva prelazimo u fazu biranja terena.
    enterPickingPhase();
  }

  function buildPickOrder() {
    // "Zmija" redosled: 1,2,...,N, pa N,...,2,1 - svaki igrac bira ukupno 2 terena.
    const ids = state.players.map((p) => p.id);
    return [...ids, ...[...ids].reverse()];
  }

  function enterPickingPhase() {
    state.phase = "picking";
    state.pickOrder = buildPickOrder();
    state.currentPickIndex = 0;
    state.playerTromedje = [];

    document.getElementById("setup-controls").style.display = "none";
    document.getElementById("picking-controls").style.display = "block";
    renderPicking();
  }

  function shareEdge(fieldsA, fieldsB) {
    // Dva temena (tromedje) su "susedna" (spojena jednim putem) ako dele TACNO 2 od 3
    // polja koja dodiruju. Ako dele samo 1 polje, nisu susedna - obe su na istom polju
    // ali na razlicitim, nesusednim temenima, pa je dozvoljeno da oba budu zauzeta.
    const common = fieldsA.filter((f) => fieldsB.includes(f));
    return common.length >= 2;
  }

  function availableTromedje() {
    return tromedje
      .map((fields, idx) => ({ idx, fields }))
      .filter(({ fields }) => !state.playerTromedje.some((t) => shareEdge(fields, t.fields)));
  }

  function describeTromedja(fields) {
    return fields
      .map((idx) => {
        const res = state.tiles[idx];
        const num = state.numbers[idx];
        const emoji = resourceEmojis[res] || "?";
        return num ? `${emoji}${num}` : `${emoji}`;
      })
      .join(" · ");
  }

  function renderPicking() {
    const turnInfo = document.getElementById("turn-indicator");
    const listEl = document.getElementById("tromedje-list");
    const startBtn = document.getElementById("btn-start-game");

    if (state.currentPickIndex >= state.pickOrder.length) {
      // Svi su izabrali - spremni smo da pokrenemo partiju.
      state.phase = "ready";
      turnInfo.textContent = "✅ Svi tereni su izabrani. Klikni „Počni igru“.";
      listEl.innerHTML = "";
      startBtn.style.display = "inline-block";
      renderBoard();
      return;
    }

    const currentPlayerId = state.pickOrder[state.currentPickIndex];
    const player = state.players.find((p) => p.id === currentPlayerId);
    turnInfo.textContent = `🎯 Na potezu: ${player ? player.name : "Igrač " + currentPlayerId} — izaberi teren (${state.currentPickIndex + 1}/${state.pickOrder.length})`;
    startBtn.style.display = "none";

    listEl.innerHTML = "";
    availableTromedje().forEach(({ idx, fields }) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.textContent = `Teren #${idx + 1}: ${describeTromedja(fields)}`;
      btn.onclick = () => pickTromedja(idx);
      li.appendChild(btn);
      listEl.appendChild(li);
    });

    renderBoard();
  }

  function pickTromedja(triIdx) {
    if (state.phase !== "picking") return;
    const currentPlayerId = state.pickOrder[state.currentPickIndex];
    const fields = tromedje[triIdx];

    state.playerTromedje.push({ id: currentPlayerId, fields });

    const brojevi = fields.map((idx) => state.numbers[idx]).filter((n) => n !== null);
    const player = state.players.find((p) => p.id === currentPlayerId);
    state.log = [
      `${player ? player.name : "Igrač " + currentPlayerId} je izabrao teren: brojevi ${brojevi.join(", ")}`,
      ...state.log,
    ].slice(0, 4);

    state.currentPickIndex += 1;
    renderPicking();
  }

  async function finalizeGame() {
    // Ovde vise NE biramo nasumicno - samo prikazujemo ono sto je igrac vec izabrao
    // tokom 'picking' faze i saljemo na server.
    if (state.phase !== "ready") return;

    state.phase = "playing";

    document.getElementById("picking-controls").style.display = "none";
    document.getElementById("game-controls").style.display = "block";
    renderPlayers();
    renderLog();
    renderBoard();

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
      phase: "tiles",
      tiles: Array(19).fill(null),
      counts: Object.fromEntries(Object.keys(resourceLimits).map((r) => [r, 0])),
      numbers: Array(19).fill(null),
      rolled: null,
      players: state.players.map((p) => ({ ...p, resources: { drvo: 0, ovca: 0, psenica: 0, cigla: 0, kamen: 0 } })),
      log: [],
      playerTromedje: [],
      pickOrder: [],
      currentPickIndex: 0,
      gameId: null,
    };
    document.getElementById("setup-controls").style.display = "block";
    document.getElementById("picking-controls").style.display = "none";
    document.getElementById("game-controls").style.display = "none";
    document.getElementById("setup-roll-result").textContent = "";
    renderBoard();
  }

  document.getElementById("btn-roll-setup").addEventListener("click", rollDiceAndAssign);
  document.getElementById("btn-start-game").addEventListener("click", finalizeGame);
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