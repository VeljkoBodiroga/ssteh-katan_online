// Port of src/Stranice/Igraj.tsx (React) na vanilla JS + Laravel API pozive.
// DVA REZIMA:
//  - MULTIPLAYER (cfg.gameId je postavljen, dosli smo iz lobija): server je izvor istine,
//    svaki browser POLL-uje /api/games/{id} na ~2.5s i renderuje ono sto server kaze. Samo
//    igrac na potezu (po pravoj ulogovanoj sesiji) moze da bira teren / baci kocku.
//  - HOTSEAT (direktan pristup /igraj bez lobija): sve se odigrava lokalno u jednom browseru,
//    korisno za brzo testiranje bez potrebe za dva naloga.
(function () {
  const cfg = window.CATAN_CONFIG;
  const MULTIPLAYER = !!cfg.gameId;

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

  // Master lista svih 24 tromedje (mesta za naselje) - MORA biti identicna serverskoj listi
  // u GameApiController.php jer server proverava indekse koje posaljemo.
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
    phase: MULTIPLAYER ? "waiting-setup" : "tiles", // hotseat: tiles->numbers->picking->ready->playing
    tiles: Array(19).fill(null),
    counts: Object.fromEntries(Object.keys(resourceLimits).map((r) => [r, 0])),
    numbers: Array(19).fill(null),
    rolled: null,
    isCreator: false,
    createdBy: null,
    turnOrder: [],
    pickTurnIndex: 0,
    playTurnIndex: 0,
    players:
      cfg.players && cfg.players.length > 0
        ? cfg.players.map((p) => ({ id: p.id, name: p.name, resources: { drvo: 0, ovca: 0, psenica: 0, cigla: 0, kamen: 0 } }))
        : [
            { id: 1, name: "Igrač 1", resources: { drvo: 0, ovca: 0, psenica: 0, cigla: 0, kamen: 0 } },
            { id: 2, name: "Igrač 2", resources: { drvo: 0, ovca: 0, psenica: 0, cigla: 0, kamen: 0 } },
          ],
    log: [],
    playerTromedje: [],
    currentPickIndex: 0, // hotseat picking
    currentTurnIndex: 0, // hotseat playing
    gameId: cfg.gameId || null,
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
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `API error ${res.status}`);
    }
    return res.json();
  }

  function playerName(id) {
    const p = state.players.find((pl) => pl.id === id);
    return p ? p.name : `Igrač ${id}`;
  }

  // ---------- Zajednicki prikaz table (koristi ga i hotseat i multiplayer) ----------
  function renderBoard() {
    const boardEl = document.getElementById("board");
    boardEl.innerHTML = "";
    let counter = 0;

    hexLayout.forEach((count) => {
      const row = document.createElement("div");
      row.className = "row";
      for (let i = 0; i < count; i++) {
        const idx = counter++;
        const hex = document.createElement("div");
        hex.className = "hex";
        hex.dataset.idx = idx;
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
        } else if (!MULTIPLAYER || state.isCreator) {
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
    renderSettlementMarkers();
  }

const PLAYER_COLORS = ["#3498db", "#e74c3c", "#2ecc71", "#f39c12"];

  function colorForPlayer(playerId) {
    const idx = state.players.findIndex((p) => p.id === playerId);
    return PLAYER_COLORS[idx >= 0 ? idx % PLAYER_COLORS.length : 0];
  }

  function renderSettlementMarkers() {
    const boardEl = document.getElementById("board");
    const boardRect = boardEl.getBoundingClientRect();

    state.playerTromedje.forEach((t) => {
      const rects = t.fields
        .map((idx) => boardEl.querySelector(`[data-idx="${idx}"]`))
        .filter(Boolean)
        .map((el) => el.getBoundingClientRect());

      if (rects.length === 0) return;

      // Teme je (priblizno) centroid centara tri polja koja dodiruje.
      const centerX = rects.reduce((sum, r) => sum + (r.left + r.width / 2), 0) / rects.length - boardRect.left;
      const centerY = rects.reduce((sum, r) => sum + (r.top + r.height / 2), 0) / rects.length - boardRect.top;

      const marker = document.createElement("div");
      marker.className = "settlement-marker";
      marker.style.left = `${centerX}px`;
      marker.style.top = `${centerY}px`;
      marker.style.background = colorForPlayer(t.id);
      marker.title = playerName(t.id);
      marker.textContent = "🏠";
      boardEl.appendChild(marker);
    });
  }



  function handleSelect(idx, res) {
    if (MULTIPLAYER && !state.isCreator) return;
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

    if (MULTIPLAYER) {
      // Kreator je gotov sa postavljanjem table - prikazi dugme za slanje na server.
      document.getElementById("btn-submit-board").style.display = "inline-block";
    } else {
      enterPickingPhaseHotseat();
    }
  }

  // ---------- MULTIPLAYER: kreator salje gotovu tablu na server ----------
  async function submitBoard() {
    try {
      await apiFetch(`/games/${state.gameId}/setup-board`, {
        method: "POST",
        body: JSON.stringify({ tiles: state.tiles, numbers: state.numbers }),
      });
      document.getElementById("setup-controls").style.display = "none";
    } catch (e) {
      alert("Greška: " + e.message);
    }
  }

  // ---------- Zajednicka logika biranja terena (opis + pravilo suseda) ----------
  function shareEdge(fieldsA, fieldsB) {
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

  // ---------- MULTIPLAYER: render picking na osnovu servera ----------
  function renderPickingMultiplayer() {
    const turnInfo = document.getElementById("turn-indicator");
    const listEl = document.getElementById("tromedje-list");
    const totalPicks = state.turnOrder.length * 2;
    const currentUserId = state.turnOrder[state.pickTurnIndex % state.turnOrder.length];
    const myTurn = currentUserId === cfg.currentUserId;

    turnInfo.textContent = myTurn
      ? `🎯 Na tebi je red da izabereš teren (${state.pickTurnIndex + 1}/${totalPicks})`
      : `⏳ Na potezu: ${playerName(currentUserId)} (${state.pickTurnIndex + 1}/${totalPicks}) — čekaj svoj red...`;

    listEl.innerHTML = "";
    availableTromedje().forEach(({ idx, fields }) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.textContent = `Teren #${idx + 1}: ${describeTromedja(fields)}`;
      btn.disabled = !myTurn;
      btn.onclick = () => pickTromedjaMultiplayer(idx);
      li.appendChild(btn);
      listEl.appendChild(li);
    });
  }

  async function pickTromedjaMultiplayer(triIdx) {
    try {
      const game = await apiFetch(`/games/${state.gameId}/pick`, {
        method: "POST",
        body: JSON.stringify({ tri_index: triIdx }),
      });
      applyServerState(game);
    } catch (e) {
      alert("Greška: " + e.message);
    }
  }

  // ---------- MULTIPLAYER: render igranja (bacanje kocke na potezu) ----------
  function renderPlayingMultiplayer() {
    const currentUserId = state.turnOrder[state.playTurnIndex % state.turnOrder.length];
    const myTurn = currentUserId === cfg.currentUserId;

    document.getElementById("turn-indicator-playing").textContent = myTurn
      ? "🎯 Ti si na potezu — baci kockicu!"
      : `⏳ Na potezu: ${playerName(currentUserId)} — čeka se...`;

    document.getElementById("dice-icon").style.display = myTurn ? "block" : "none";
    document.getElementById("btn-next-turn").style.display = "none"; // red se automatski predaje na serveru
  }

  async function rollGameDiceMultiplayer() {
    const diceIcon = document.getElementById("dice-icon");
    diceIcon.classList.add("dice-shake");
    setTimeout(() => diceIcon.classList.remove("dice-shake"), 500);

    try {
      const game = await apiFetch(`/games/${state.gameId}/roll`, { method: "POST" });
      applyServerState(game);
    } catch (e) {      alert("Greška: " + e.message);
    }
  }

  // ---------- MULTIPLAYER: primeni stanje dobijeno sa servera ----------
  function applyServerState(game) {
    state.createdBy = game.created_by;
    state.isCreator = game.created_by === cfg.currentUserId;

    state.players = game.players.map((p) => ({
      id: p.id,
      name: p.username,
      resources: Object.assign({ drvo: 0, ovca: 0, psenica: 0, cigla: 0, kamen: 0 }, p.resources || {}),
    }));

    const bs = game.board_state;

    if (!bs) {
      // Tabla jos nije postavljena.
      state.phase = "waiting-setup";
      document.getElementById("setup-controls").style.display = state.isCreator ? "block" : "none";
      document.getElementById("waiting-host-msg").style.display = state.isCreator ? "none" : "block";
      document.getElementById("picking-controls").style.display = "none";
      document.getElementById("game-controls").style.display = "none";
      renderBoard();
      return;
    }

    state.tiles = bs.tiles;
    state.numbers = bs.numbers;
    state.turnOrder = bs.turnOrder || [];
    state.pickTurnIndex = bs.pickTurnIndex || 0;
    state.playTurnIndex = bs.playTurnIndex || 0;
    state.playerTromedje = bs.playerTromedje || [];
    state.log = bs.log || [];
    state.phase = bs.phase;

    document.getElementById("setup-controls").style.display = "none";
    document.getElementById("waiting-host-msg").style.display = "none";

    if (bs.phase === "picking") {
      document.getElementById("picking-controls").style.display = "block";
      document.getElementById("game-controls").style.display = "none";
      document.getElementById("btn-start-game").style.display = "none";
      renderPickingMultiplayer();
    } else if (bs.phase === "playing") {
      document.getElementById("picking-controls").style.display = "none";
      document.getElementById("game-controls").style.display = "block";
      renderPlayers();
      renderLog();
      renderPlayingMultiplayer();
    }

    renderBoard();
  }

  async function pollLoop() {
    if (!MULTIPLAYER) return;
    try {
      const game = await apiFetch(`/games/${state.gameId}`);
      applyServerState(game);
    } catch (e) {
      console.warn("Greška pri osvežavanju partije:", e);
    }
    setTimeout(pollLoop, 1000);
  }

  // ---------- HOTSEAT (bez lobija - lokalna simulacija u jednom browseru) ----------
  function buildPickOrder() {
    const ids = state.players.map((p) => p.id);
    return [...ids, ...[...ids].reverse()];
  }

  function enterPickingPhaseHotseat() {
    state.phase = "picking";
    state.pickOrderHotseat = buildPickOrder();
    state.currentPickIndex = 0;
    state.playerTromedje = [];

    document.getElementById("setup-controls").style.display = "none";
    document.getElementById("picking-controls").style.display = "block";
    renderPickingHotseat();
  }

  function renderPickingHotseat() {
    const turnInfo = document.getElementById("turn-indicator");
    const listEl = document.getElementById("tromedje-list");
    const startBtn = document.getElementById("btn-start-game");

    if (state.currentPickIndex >= state.pickOrderHotseat.length) {
      state.phase = "ready";
      turnInfo.textContent = "✅ Svi tereni su izabrani. Klikni „Počni igru“.";
      listEl.innerHTML = "";
      startBtn.style.display = "inline-block";
      renderBoard();
      return;
    }

    const currentPlayerId = state.pickOrderHotseat[state.currentPickIndex];
    turnInfo.textContent = `🎯 Na potezu: ${playerName(currentPlayerId)} — izaberi teren (${state.currentPickIndex + 1}/${state.pickOrderHotseat.length})`;
    startBtn.style.display = "none";

    listEl.innerHTML = "";
    availableTromedje().forEach(({ idx, fields }) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.textContent = `Teren #${idx + 1}: ${describeTromedja(fields)}`;
      btn.onclick = () => pickTromedjaHotseat(idx);
      li.appendChild(btn);
      listEl.appendChild(li);
    });

    renderBoard();
  }

  function pickTromedjaHotseat(triIdx) {
    const currentPlayerId = state.pickOrderHotseat[state.currentPickIndex];
    const fields = tromedje[triIdx];
    state.playerTromedje.push({ id: currentPlayerId, fields });

    const brojevi = fields.map((idx) => state.numbers[idx]).filter((n) => n !== null);
    state.log = [`${playerName(currentPlayerId)} je izabrao selo: brojevi ${brojevi.join(", ")}`, ...state.log].slice(0, 4);

    state.currentPickIndex += 1;
    renderPickingHotseat();
  }

  async function finalizeGameHotseat() {
    if (state.phase !== "ready") return;
    state.phase = "playing";

    document.getElementById("picking-controls").style.display = "none";
    document.getElementById("game-controls").style.display = "block";
    state.currentTurnIndex = 0;
    renderPlayers();
    renderLog();
    renderBoard();
    renderTurnHotseat();

    try {
      const game = await apiFetch("/games", {
        method: "POST",
        body: JSON.stringify({ board_state: { tiles: state.tiles, numbers: state.numbers, playerTromedje: state.playerTromedje } }),
      });
      state.gameId = game.id;
    } catch (e) {
      console.warn("Nije moguće sačuvati partiju na serveru:", e);
    }
  }

  function renderTurnHotseat() {
    const player = state.players[state.currentTurnIndex];
    document.getElementById("turn-indicator-playing").textContent = `🎯 Na potezu: ${player ? player.name : "?"}`;
    document.getElementById("dice-icon").style.display = "block";
    document.getElementById("btn-next-turn").style.display = "none";
  }

  function nextTurnHotseat() {
    state.currentTurnIndex = (state.currentTurnIndex + 1) % state.players.length;
    renderTurnHotseat();
  }

  async function rollGameDiceHotseat() {
    if (document.getElementById("dice-icon").style.display === "none") return;

    const diceIcon = document.getElementById("dice-icon");
    diceIcon.classList.add("dice-shake");
    setTimeout(() => diceIcon.classList.remove("dice-shake"), 500);

    let dice;
    try {
      const result = state.gameId ? await apiFetch(`/games/${state.gameId}/roll`, { method: "POST" }) : null;
      dice = result ? result.roll || rollOneDie() + rollOneDie() : rollOneDie() + rollOneDie();
    } catch (e) {
      dice = rollOneDie() + rollOneDie();
    }
    state.log = [`Dobijen je broj ${dice}`, ...state.log].slice(0, 4);
    state.rolled = dice;

    state.players = state.players.map((p) => {
      const upd = { ...p, resources: { ...p.resources } };
      state.playerTromedje
        .filter((t) => t.id === p.id)
        .forEach((trom) => {
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

    document.getElementById("dice-icon").style.display = "none";
    document.getElementById("btn-next-turn").style.display = "inline-block";
  }

  // ---------- Zajednicko ----------
  function renderPlayers() {
    const el = document.getElementById("player-info");
    el.innerHTML = "";
    state.players.forEach((p) => {
      const box = document.createElement("div");
      box.className = "player-box";
      box.innerHTML = `<h3 style="margin:0">${p.name}</h3>
        <p>🌲 ${p.resources.drvo || 0} 🐑 ${p.resources.ovca || 0} 🌾 ${p.resources.psenica || 0} 🧱 ${p.resources.cigla || 0} 🪨 ${p.resources.kamen || 0}</p>`;
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
    if (!state.gameId) return alert("Prvo pokreni partiju.");
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

  function resetGame() {
    if (!window.confirm("Reset partiju?")) return;
    window.location.reload();
  }

  document.getElementById("btn-roll-setup").addEventListener("click", rollDiceAndAssign);
  document.getElementById("dice-icon").addEventListener("click", MULTIPLAYER ? rollGameDiceMultiplayer : rollGameDiceHotseat);
  document.getElementById("btn-finish-game").addEventListener("click", () => {
    window.location.href = "/";
  });
  document.getElementById("btn-save").addEventListener("click", saveGame);
  document.getElementById("btn-reset").addEventListener("click", resetGame);

  if (MULTIPLAYER) {
    document.getElementById("btn-submit-board").addEventListener("click", submitBoard);
    document.getElementById("btn-load").style.display = "none";
    document.getElementById("btn-save").style.display = "none";
    pollLoop();
  } else {
    document.getElementById("btn-start-game").addEventListener("click", finalizeGameHotseat);
    document.getElementById("btn-next-turn").addEventListener("click", nextTurnHotseat);
    document.getElementById("btn-load").addEventListener("click", async () => {
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
    });
    renderBoard();
  }
})();