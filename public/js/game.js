// Port of src/Stranice/Igraj.tsx (React) na vanilla JS + Laravel API pozive.
// DVA REZIMA:
//  - MULTIPLAYER (cfg.gameId je postavljen, dosli smo iz lobija): server je izvor istine,
//    svaki browser POLL-uje /api/games/{id} na ~1s i renderuje ono sto server kaze. Samo
//    igrac na potezu (po pravoj ulogovanoj sesiji) moze da bira teren / baci kocku / gradi.
//  - HOTSEAT (direktan pristup /igraj bez lobija): sve se odigrava lokalno u jednom browseru,
//    korisno za brzo testiranje bez potrebe za dva naloga (bez sistema puteva).
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

  // Master lista svih 24 tromedje (mesta za naselje) - MORA biti identicna serverskoj listi.
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

  // Master lista svih 30 moguca "puta" (ivica izmedju dva susedna temena) - MORA biti
  // identicna serverskoj listi u GameApiController.php.
  const edges = [
    [0, 3], [0, 4], [1, 2], [1, 4], [2, 9], [3, 5], [4, 7], [5, 6], [5, 8], [6, 12],
    [7, 8], [7, 10], [8, 14], [9, 10], [9, 11], [10, 16], [11, 18], [12, 13], [13, 14], [13, 19],
    [14, 15], [15, 16], [15, 21], [16, 17], [17, 18], [17, 23], [19, 20], [20, 21], [21, 22], [22, 23],
  ];

  let state = {
    phase: MULTIPLAYER ? "waiting-setup" : "tiles",
    tiles: Array(19).fill(null),
    counts: Object.fromEntries(Object.keys(resourceLimits).map((r) => [r, 0])),
    numbers: Array(19).fill(null),
    rolled: null,
    isCreator: false,
    createdBy: null,
    turnOrder: [],
    pickTurnIndex: 0,
    pickSubPhase: "settlement",
    pendingRoadVertex: null,
    playTurnIndex: 0,
    hasRolledThisTurn: false,
    mustDiscard: {},
    roadBuildMode: false,
    settlementBuildMode: false,
    cityBuildMode: false,
    roads: [],
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

  const PLAYER_COLORS = ["#3498db", "#e74c3c", "#2ecc71", "#f39c12"];
  function colorForPlayer(playerId) {
    const idx = state.players.findIndex((p) => p.id === playerId);
    return PLAYER_COLORS[idx >= 0 ? idx % PLAYER_COLORS.length : 0];
  }

  // ---------- Zajednicki prikaz table ----------
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
    renderRoadMarkers();
    renderSettlementSlots();
  }

  // Tacna pozicija temena (vertex) = prosek centara tri polja koja dodiruje,
  // izracunato iz STVARNIH pozicija na ekranu (getBoundingClientRect), relativno na #board.
  function getVertexPixelPosition(triIdx) {
    const boardEl = document.getElementById("board");
    const boardRect = boardEl.getBoundingClientRect();
    const fields = tromedje[triIdx];
    const rects = fields
      .map((idx) => boardEl.querySelector(`[data-idx="${idx}"]`))
      .filter(Boolean)
      .map((el) => el.getBoundingClientRect());
    if (rects.length === 0) return null;
    const x = rects.reduce((sum, r) => sum + (r.left + r.width / 2), 0) / rects.length - boardRect.left;
    const y = rects.reduce((sum, r) => sum + (r.top + r.height / 2), 0) / rects.length - boardRect.top;
    return { x, y };
  }

  function renderSettlementMarkers() {
    const boardEl = document.getElementById("board");
    state.playerTromedje.forEach((t) => {
      const triIdx = t.tri_index !== undefined ? t.tri_index : tromedje.findIndex((f) => f.length === t.fields.length && f.every((v, i) => v === t.fields[i]));
      const pos = triIdx >= 0 ? getVertexPixelPosition(triIdx) : null;
      if (!pos) return;

      const isCity = t.type === "city";
      const upgradeable = state.cityBuildMode && t.id === cfg.currentUserId && !isCity;

      const marker = document.createElement("div");
      marker.className = "settlement-marker" + (upgradeable ? " settlement-upgradeable" : "");
      marker.style.left = `${pos.x}px`;
      marker.style.top = `${pos.y}px`;
      marker.style.background = colorForPlayer(t.id);
      marker.title = playerName(t.id) + (isCity ? " (grad)" : "");
      marker.textContent = isCity ? "🏛️" : "🏠";
      if (upgradeable) {
        marker.style.pointerEvents = "auto";
        marker.style.cursor = "pointer";
        marker.onclick = () => buildCityMultiplayer(triIdx);
      }
      boardEl.appendChild(marker);
    });
  }

    function renderRoadMarkers() {
    const boardEl = document.getElementById("board");

    state.roads.forEach((r) => {
      drawRoadBar(edges[r.edge_index], colorForPlayer(r.id), false, null);
    });

    if (state.roadBuildMode) {
      availableRoadEdges().forEach(({ idx, e }) => {
        drawRoadBar(e, "rgba(255,255,255,0.85)", true, () => buildRoadMultiplayer(idx));
      });
    }

    if (state.phase === "picking" && state.pickSubPhase === "road") {
      const currentUserId = state.turnOrder[state.pickTurnIndex % state.turnOrder.length];
      if (currentUserId === cfg.currentUserId) {
        availablePickRoadEdges().forEach(({ idx, e }) => {
          drawRoadBar(e, "rgba(255,255,255,0.85)", true, () => pickRoadMultiplayer(idx));
        });
      }
    }
  }

  function availablePickRoadEdges() {
    const builtSet = new Set(state.roads.map((r) => r.edge_index));
    return edges
      .map((e, idx) => ({ idx, e }))
      .filter(({ idx, e }) => !builtSet.has(idx) && e.includes(state.pendingRoadVertex));
  }

  async function pickRoadMultiplayer(edgeIdx) {
    try {
      const game = await apiFetch(`/games/${state.gameId}/pick-road`, {
        method: "POST",
        body: JSON.stringify({ edge_index: edgeIdx }),
      });
      applyServerState(game);
    } catch (e) {
      alert("Greška: " + e.message);
    }
  }

  function availableSettlementSpots() {
    const myId = cfg.currentUserId;
    const myRoadVertIndices = new Set(
      state.roads.filter((r) => r.id === myId).flatMap((r) => edges[r.edge_index])
    );
    return tromedje
      .map((fields, idx) => ({ idx, fields }))
      .filter(({ idx, fields }) => {
        if (!myRoadVertIndices.has(idx)) return false;
        return !state.playerTromedje.some((t) => shareEdge(fields, t.fields));
      });
  }

  function renderSettlementSlots() {
    if (!state.settlementBuildMode) return;
    const boardEl = document.getElementById("board");
    availableSettlementSpots().forEach(({ idx }) => {
      const pos = getVertexPixelPosition(idx);
      if (!pos) return;
      const slot = document.createElement("div");
      slot.className = "settlement-slot";
      slot.style.left = `${pos.x}px`;
      slot.style.top = `${pos.y}px`;
      slot.onclick = () => buildSettlementMultiplayer(idx);
      boardEl.appendChild(slot);
    });
  }

  function drawRoadBar(edgeVertices, color, clickable, onClick) {
    const boardEl = document.getElementById("board");
    const [triA, triB] = edgeVertices;
    const posA = getVertexPixelPosition(triA);
    const posB = getVertexPixelPosition(triB);
    if (!posA || !posB) return;

    const midX = (posA.x + posB.x) / 2;
    const midY = (posA.y + posB.y) / 2;
    const dx = posB.x - posA.x;
    const dy = posB.y - posA.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

    const bar = document.createElement("div");
    bar.className = clickable ? "road-marker road-slot" : "road-marker";
    bar.style.left = `${midX}px`;
    bar.style.top = `${midY}px`;
    bar.style.width = `${length}px`;    bar.style.background = color;
    bar.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
    if (clickable) bar.onclick = onClick;
    boardEl.appendChild(bar);
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
      document.getElementById("btn-submit-board").style.display = "inline-block";
    } else {
      enterPickingPhaseHotseat();
    }
  }

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

  function shareEdge(fieldsA, fieldsB) {
    const common = fieldsA.filter((f) => fieldsB.includes(f));
    return common.length >= 2;
  }

  function availableTromedje() {
    return tromedje
      .map((fields, idx) => ({ idx, fields }))
      .filter(({ fields }) => !state.playerTromedje.some((t) => shareEdge(fields, t.fields)));
  }

  // Isti algoritam kao na serveru: koje ivice smem da gradim (nadovezuju se na moje
  // selo ili moj postojeci put, a ne prolaze kroz tudje selo).
    function availableRoadEdges() {
    const myId = cfg.currentUserId;
    const mySettlementVertIndices = new Set(state.playerTromedje.filter((t) => t.id === myId).map((t) => t.tri_index));
    const enemySettlementVertIndices = new Set(state.playerTromedje.filter((t) => t.id !== myId).map((t) => t.tri_index));
    const builtSet = new Set(state.roads.map((r) => r.edge_index));

    // Vertex indeksi (tromedje indeksi) na krajevima mojih vec izgradjenih puteva.
    const myRoadVertIndices = new Set(
      state.roads.filter((r) => r.id === myId).flatMap((r) => edges[r.edge_index])
    );

    return edges
      .map((e, idx) => ({ idx, e }))
      .filter(({ idx, e }) => {
        if (builtSet.has(idx)) return false;
        return e.some((triIdx) => {
          const isMySettlement = mySettlementVertIndices.has(triIdx);
          const isEnemySettlement = enemySettlementVertIndices.has(triIdx);
          const isMyRoadEnd = myRoadVertIndices.has(triIdx) && !isEnemySettlement;
          return isMySettlement || isMyRoadEnd;
        });
      });
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

  // ---------- MULTIPLAYER: picking ----------
    function renderPickingMultiplayer() {
    const turnInfo = document.getElementById("turn-indicator");
    const listEl = document.getElementById("tromedje-list");
    const totalPicks = state.turnOrder.length * 2;
    const currentUserId = state.turnOrder[state.pickTurnIndex % state.turnOrder.length];
    const myTurn = currentUserId === cfg.currentUserId;

    if (state.pickSubPhase === "road") {
      turnInfo.textContent = myTurn
        ? `🎯 Sad izgradi (besplatan) put tačno pored svog novog sela (${state.pickTurnIndex + 1}/${totalPicks})`
        : `⏳ Na potezu: ${playerName(currentUserId)} gradi put (${state.pickTurnIndex + 1}/${totalPicks}) — čekaj svoj red...`;
      listEl.innerHTML = "";
      return;
    }

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

    // ---------- MULTIPLAYER: igranje (kocka -> (gradnja) -> Dalje) ----------
  function renderPlayingMultiplayer() {
    const currentUserId = state.turnOrder[state.playTurnIndex % state.turnOrder.length];
    const myTurn = currentUserId === cfg.currentUserId;
    const turnEl = document.getElementById("turn-indicator-playing");
    const pendingIds = Object.keys(state.mustDiscard || {});

    if (pendingIds.length > 0) {
      const names = pendingIds.map((id) => playerName(Number(id))).join(", ");
      turnEl.textContent = `⚠️ Pao je 7! Čeka se odbacivanje karata: ${names}`;
      document.getElementById("dice-icon").style.display = "none";
      document.getElementById("btn-next-turn").style.display = "none";
      document.getElementById("btn-build-road").style.display = "none";
      document.getElementById("btn-build-settlement").style.display = "none";
      document.getElementById("btn-build-city").style.display = "none";
      document.getElementById("btn-trade-resources").style.display = "none";
      document.getElementById("trade-panel").style.display = "none";
      renderDiscardPanel();
      return;
    }

    document.getElementById("discard-panel").style.display = "none";

    if (!myTurn) {
      turnEl.textContent = `⏳ Na potezu: ${playerName(currentUserId)} — čeka se...`;
    } else if (!state.hasRolledThisTurn) {
      turnEl.textContent = "🎯 Ti si na potezu — baci kockicu!";
    } else {
      turnEl.textContent = "🎯 Ti si na potezu";
    }

    document.getElementById("dice-icon").style.display = myTurn && !state.hasRolledThisTurn ? "block" : "none";
    document.getElementById("btn-next-turn").style.display = myTurn && state.hasRolledThisTurn ? "inline-block" : "none";
    document.getElementById("btn-build-road").style.display = myTurn && state.hasRolledThisTurn ? "inline-block" : "none";
    document.getElementById("btn-build-settlement").style.display = myTurn && state.hasRolledThisTurn ? "inline-block" : "none";
    document.getElementById("btn-build-city").style.display = myTurn && state.hasRolledThisTurn ? "inline-block" : "none";
    document.getElementById("btn-trade-resources").style.display = myTurn && state.hasRolledThisTurn ? "inline-block" : "none";

    if (!myTurn || !state.hasRolledThisTurn) {
      state.roadBuildMode = false;
      state.settlementBuildMode = false;
      state.cityBuildMode = false;
      document.getElementById("trade-panel").style.display = "none";
    }
  }

  function renderDiscardPanel() {
    const panel = document.getElementById("discard-panel");
    const myRequired = state.mustDiscard[cfg.currentUserId];
    if (myRequired === undefined) {
      panel.style.display = "none";
      return;
    }
    const me = state.players.find((p) => p.id === cfg.currentUserId);
    panel.style.display = "flex";
    document.getElementById("discard-info").textContent = `Moraš odbaciti ${myRequired} karata:`;
    ["drvo", "ovca", "psenica", "cigla", "kamen"].forEach((res) => {
      const input = document.getElementById(`discard-${res}`);
      const max = me ? me.resources[res] || 0 : 0;
      input.max = max;
      if (Number(input.value) > max) input.value = max;
    });
  }

  async function confirmDiscard() {
    const resources = {};
    ["drvo", "ovca", "psenica", "cigla", "kamen"].forEach((res) => {
      resources[res] = Number(document.getElementById(`discard-${res}`).value) || 0;
    });
    try {
      const game = await apiFetch(`/games/${state.gameId}/discard`, {
        method: "POST",
        body: JSON.stringify({ resources }),
      });
      applyServerState(game);
    } catch (e) {
      alert("Greška: " + e.message);
    }
  }

  async function rollGameDiceMultiplayer() {
    const diceIcon = document.getElementById("dice-icon");
    diceIcon.classList.add("dice-shake");
    setTimeout(() => diceIcon.classList.remove("dice-shake"), 500);

    try {
      const game = await apiFetch(`/games/${state.gameId}/roll`, { method: "POST" });
      applyServerState(game);
    } catch (e) {
      alert("Greška: " + e.message);
    }
  }

  function toggleRoadBuildMode() {
    state.roadBuildMode = !state.roadBuildMode;
    renderBoard();
  }

  async function buildRoadMultiplayer(edgeIdx) {
    try {
      const game = await apiFetch(`/games/${state.gameId}/build-road`, {
        method: "POST",
        body: JSON.stringify({ edge_index: edgeIdx }),
      });
      state.roadBuildMode = false;
      applyServerState(game);
    } catch (e) {
      alert("Greška: " + e.message);
    }
  }

  function toggleSettlementBuildMode() {
    state.settlementBuildMode = !state.settlementBuildMode;
    renderBoard();
  }

  async function buildSettlementMultiplayer(triIdx) {
    try {
      const game = await apiFetch(`/games/${state.gameId}/build-settlement`, {
        method: "POST",
        body: JSON.stringify({ tri_index: triIdx }),
      });
      state.settlementBuildMode = false;
      applyServerState(game);
    } catch (e) {
      alert("Greška: " + e.message);
    }
  }

  function toggleCityBuildMode() {
    state.cityBuildMode = !state.cityBuildMode;
    renderBoard();
  }

  async function buildCityMultiplayer(triIdx) {
    try {
      const game = await apiFetch(`/games/${state.gameId}/build-city`, {
        method: "POST",
        body: JSON.stringify({ tri_index: triIdx }),
      });
      state.cityBuildMode = false;
      applyServerState(game);
    } catch (e) {
      alert("Greška: " + e.message);
    }
  }

  function toggleTradePanel() {
    const panel = document.getElementById("trade-panel");
    panel.style.display = panel.style.display === "none" ? "flex" : "none";
  }

  async function confirmTrade() {
    const give = document.getElementById("trade-give").value;
    const get = document.getElementById("trade-get").value;
    if (give === get) return alert("Izaberi različite resurse.");
    try {
      const game = await apiFetch(`/games/${state.gameId}/trade`, {
        method: "POST",
        body: JSON.stringify({ give, get }),
      });
      document.getElementById("trade-panel").style.display = "none";
      applyServerState(game);
    } catch (e) {
      alert("Greška: " + e.message);
    }
  }



  async function endTurnMultiplayer() {
    try {
      const game = await apiFetch(`/games/${state.gameId}/end-turn`, { method: "POST" });
      state.roadBuildMode = false;
      applyServerState(game);
    } catch (e) {
      alert("Greška: " + e.message);
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

    if (game.status === "finished") {
      showGameOver(game);
      return;
    }

    const bs = game.board_state;

    if (!bs) {
      state.phase = "waiting-setup";      document.getElementById("setup-controls").style.display = state.isCreator ? "block" : "none";
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
    state.pickSubPhase = bs.pickSubPhase || "settlement";
    state.pendingRoadVertex = bs.pendingRoadVertex ?? null;
    state.playTurnIndex = bs.playTurnIndex || 0;
    state.hasRolledThisTurn = bs.hasRolledThisTurn || false;
    state.mustDiscard = bs.mustDiscard || {};
    state.playerTromedje = bs.playerTromedje || [];
    state.roads = bs.roads || [];
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

  function showGameOver(game) {
    document.getElementById("setup-controls").style.display = "none";
    document.getElementById("waiting-host-msg").style.display = "none";
    document.getElementById("picking-controls").style.display = "none";
    document.getElementById("game-controls").style.display = "none";

    const winnerId = game.board_state ? game.board_state.winnerId : null;
    const winnerName = winnerId ? playerName(winnerId) : "?";
    document.getElementById("game-over-text").textContent = `🏆 Pobednik: ${winnerName}!`;
    document.getElementById("game-over-overlay").style.display = "flex";
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

  // ---------- HOTSEAT (bez lobija - lokalna simulacija, bez sistema puteva) ----------
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
    state.log = [`${playerName(currentPlayerId)} je izabrao teren: brojevi ${brojevi.join(", ")}`, ...state.log].slice(0, 4);

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

    function calculatePoints(playerId) {
    return state.playerTromedje
      .filter((t) => t.id === playerId)
      .reduce((sum, t) => sum + (t.type === "city" ? 2 : 1), 0);
  }

  function renderPlayers() {
    const el = document.getElementById("player-info");
    el.innerHTML = "";
    const visiblePlayers = MULTIPLAYER ? state.players.filter((p) => p.id === cfg.currentUserId) : state.players;
    visiblePlayers.forEach((p) => {
      const box = document.createElement("div");
      box.className = "player-box";
      box.innerHTML = `<h3 style="margin:0">${p.name} — 🏆 ${calculatePoints(p.id)} poena</h3>
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



  document.getElementById("btn-roll-setup").addEventListener("click", rollDiceAndAssign);
  document.getElementById("dice-icon").addEventListener("click", MULTIPLAYER ? rollGameDiceMultiplayer : rollGameDiceHotseat);
  document.getElementById("btn-finish-game").addEventListener("click", () => {
    window.location.href = "/";
  });
  document.getElementById("btn-save").addEventListener("click", saveGame);
  document.getElementById("btn-next-turn").addEventListener("click", MULTIPLAYER ? endTurnMultiplayer : nextTurnHotseat);

  if (MULTIPLAYER) {
    document.getElementById("btn-submit-board").addEventListener("click", submitBoard);
    document.getElementById("btn-build-road").addEventListener("click", toggleRoadBuildMode);
    document.getElementById("btn-build-settlement").addEventListener("click", toggleSettlementBuildMode);
    document.getElementById("btn-build-city").addEventListener("click", toggleCityBuildMode);
    document.getElementById("btn-trade-resources").addEventListener("click", toggleTradePanel);
    document.getElementById("btn-confirm-trade").addEventListener("click", confirmTrade);
    document.getElementById("btn-confirm-discard").addEventListener("click", confirmDiscard);
    document.getElementById("btn-load").style.display = "none";
    document.getElementById("btn-save").style.display = "none";
    pollLoop();
  } else {
    document.getElementById("btn-start-game").addEventListener("click", finalizeGameHotseat);
    document.getElementById("btn-build-road").style.display = "none";
    document.getElementById("btn-build-settlement").style.display = "none";
    document.getElementById("btn-build-city").style.display = "none";
    document.getElementById("btn-trade-resources").style.display = "none";
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