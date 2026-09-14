
(function () {
  const podesavanja = window.CATAN_CONFIG;
  const VISE_IGRACA = !!podesavanja.gameId;

  const rasporedRedova = [3, 4, 5, 4, 3];
  const maksResursa = { pustinja: 1, drvo: 4, ovca: 4, psenica: 4, cigla: 3, kamen: 3 };
  const emojiResursa = { pustinja: "🏜", drvo: "🌲", ovca: "🐑", psenica: "🌾", cigla: "🧱", kamen: "🪨" };
  const slikeResursa = {
    pustinja: `${podesavanja.imagesBase}/pustinja.png`,
    drvo: `${podesavanja.imagesBase}/drvo.png`,
    ovca: `${podesavanja.imagesBase}/ovca.png`,
    psenica: `${podesavanja.imagesBase}/psenica.png`,
    cigla: `${podesavanja.imagesBase}/cigla.png`,
    kamen: `${podesavanja.imagesBase}/kamen.png`,
  };

  const zetoniBrojeva = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];
  const spoljniPrsten = [0, 1, 2, 6, 11, 15, 18, 17, 16, 12, 7, 3];
  const unutrasnjiPrsten = [4, 5, 10, 14, 13, 8];
  const center = 9;
  const indeksiUglova = [0, 2, 11, 18, 16, 7];

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
  // identicna serverskoj listi u GameApiController.php
  const ivice = [
    [0, 3], [0, 4], [1, 2], [1, 4], [2, 9], [3, 5], [4, 7], [5, 6], [5, 8], [6, 12],
    [7, 8], [7, 10], [8, 14], [9, 10], [9, 11], [10, 16], [11, 18], [12, 13], [13, 14], [13, 19],
    [14, 15], [15, 16], [15, 21], [16, 17], [17, 18], [17, 23], [19, 20], [20, 21], [21, 22], [22, 23],
  ];

  let stanje = {
    phase: VISE_IGRACA ? "waiting-setup" : "tiles",
    tiles: Array(19).fill(null),
    counts: Object.fromEntries(Object.keys(maksResursa).map((r) => [r, 0])),
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
      podesavanja.players && podesavanja.players.length > 0
        ? podesavanja.players.map((p) => ({ id: p.id, name: p.name, resources: { drvo: 0, ovca: 0, psenica: 0, cigla: 0, kamen: 0 } }))
        : [
            { id: 1, name: "Igrač 1", resources: { drvo: 0, ovca: 0, psenica: 0, cigla: 0, kamen: 0 } },
            { id: 2, name: "Igrač 2", resources: { drvo: 0, ovca: 0, psenica: 0, cigla: 0, kamen: 0 } },
          ],
    log: [],
    playerTromedje: [],
    currentPickIndex: 0, // hotseat picking
    currentTurnIndex: 0, // hotseat playing
    gameId: podesavanja.gameId || null,
  };

  function baciJednuKocku() {
    return Math.floor(Math.random() * 6) + 1;
  }

  async function pozoviApi(path, options = {}) {
    const res = await fetch(`${podesavanja.apiBase}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": podesavanja.csrfToken,
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

  function imeIgraca(id) {
    const p = stanje.players.find((pl) => pl.id === id);
    return p ? p.name : `Igrač ${id}`;
  }

  const BOJE_IGRACA = ["#3498db", "#e74c3c", "#2ecc71", "#f39c12"];
  function bojaIgraca(playerId) {
    const idx = stanje.players.findIndex((p) => p.id === playerId);
    return BOJE_IGRACA[idx >= 0 ? idx % BOJE_IGRACA.length : 0];
  }

  // prikaz table
  function iscrtajTablu() {
    const boardEl = document.getElementById("board");
    boardEl.innerHTML = "";
    let counter = 0;

    rasporedRedova.forEach((count) => {
      const row = document.createElement("div");
      row.className = "row";
      for (let i = 0; i < count; i++) {
        const idx = counter++;
        const hex = document.createElement("div");
        hex.className = "hex";
        hex.dataset.idx = idx;

        if (stanje.tiles[idx]) {
          const img = document.createElement("img");
          img.src = slikeResursa[stanje.tiles[idx]];
          img.alt = stanje.tiles[idx];
          hex.appendChild(img);
          if (stanje.numbers[idx]) {
            const numDiv = document.createElement("div");
            numDiv.className = "number";
            numDiv.textContent = stanje.numbers[idx];
            hex.appendChild(numDiv);
          }
        } else if (!VISE_IGRACA || stanje.isCreator) {
          const grid = document.createElement("div");
          grid.className = "options-grid";
          Object.keys(maksResursa).forEach((res) => {
            const btn = document.createElement("button");
            btn.textContent = emojiResursa[res];
            btn.onclick = () => obradiIzborResursa(idx, res);
            grid.appendChild(btn);
          });
          hex.appendChild(grid);
        }

        row.appendChild(hex);
      }
      boardEl.appendChild(row);
    });

    iscrtajOznakeSela();
    iscrtajOznakePuteva();
    iscrtajMestaZaSelo();
  }

  // Tacna pozicija temena (vertex) 
  function pozicijaTemena(indeksTemena) {
    const boardEl = document.getElementById("board");
    const boardRect = boardEl.getBoundingClientRect();
    const fields = tromedje[indeksTemena];
    const rects = fields
      .map((idx) => boardEl.querySelector(`[data-idx="${idx}"]`))
      .filter(Boolean)
      .map((el) => el.getBoundingClientRect());
    if (rects.length === 0) return null;
    const x = rects.reduce((sum, r) => sum + (r.left + r.width / 2), 0) / rects.length - boardRect.left;
    const y = rects.reduce((sum, r) => sum + (r.top + r.height / 2), 0) / rects.length - boardRect.top;
    return { x, y };
  }

  function iscrtajOznakeSela() {
    const boardEl = document.getElementById("board");
    stanje.playerTromedje.forEach((t) => {
      const indeksTemena = t.tri_index !== undefined ? t.tri_index : tromedje.findIndex((f) => f.length === t.fields.length && f.every((v, i) => v === t.fields[i]));
      const pos = indeksTemena >= 0 ? pozicijaTemena(indeksTemena) : null;
      if (!pos) return;

      const isCity = t.type === "city";
      const upgradeable = stanje.cityBuildMode && t.id === podesavanja.currentUserId && !isCity;

      const marker = document.createElement("div");
      marker.className = "settlement-marker" + (upgradeable ? " settlement-upgradeable" : "");
      marker.style.left = `${pos.x}px`;
      marker.style.top = `${pos.y}px`;
      marker.style.background = bojaIgraca(t.id);
      marker.title = imeIgraca(t.id) + (isCity ? " (grad)" : "");
      marker.textContent = isCity ? "🏛️" : "🏠";
      if (upgradeable) {
        marker.style.pointerEvents = "auto";
        marker.style.cursor = "pointer";
        marker.onclick = () => izgradiGradVisestruko(indeksTemena);
      }
      boardEl.appendChild(marker);
    });
  }

    function iscrtajOznakePuteva() {
    const boardEl = document.getElementById("board");

    stanje.roads.forEach((r) => {
      nacrtajPut(ivice[r.edge_index], bojaIgraca(r.id), false, null);
    });

    if (stanje.roadBuildMode) {
      dostupniPutevi().forEach(({ idx, e }) => {
        nacrtajPut(e, "rgba(255,255,255,0.85)", true, () => sagradiPutVisestruko(idx));
      });
    }

    if (stanje.phase === "picking" && stanje.pickSubPhase === "road") {
      const currentUserId = stanje.turnOrder[stanje.pickTurnIndex % stanje.turnOrder.length];
      if (currentUserId === podesavanja.currentUserId) {
        dostupniPuteviZaBiranje().forEach(({ idx, e }) => {
          nacrtajPut(e, "rgba(255,255,255,0.85)", true, () => izaberiPutVisestruko(idx));
        });
      }
    }
  }

  function dostupniPuteviZaBiranje() {
    const builtSet = new Set(stanje.roads.map((r) => r.edge_index));
    return ivice
      .map((e, idx) => ({ idx, e }))
      .filter(({ idx, e }) => !builtSet.has(idx) && e.includes(stanje.pendingRoadVertex));
  }

  async function izaberiPutVisestruko(indeksIvice) {
    try {
      const game = await pozoviApi(`/games/${stanje.gameId}/pick-road`, {
        method: "POST",
        body: JSON.stringify({ edge_index: indeksIvice }),
      });
      primeniStanjeSaServera(game);
    } catch (e) {
      alert("Greška: " + e.message);
    }
  }

  function dostupnaMestaZaSelo() {
    const myId = podesavanja.currentUserId;
    const myRoadVertIndices = new Set(
      stanje.roads.filter((r) => r.id === myId).flatMap((r) => ivice[r.edge_index])
    );
    return tromedje
      .map((fields, idx) => ({ idx, fields }))
      .filter(({ idx, fields }) => {
        if (!myRoadVertIndices.has(idx)) return false;
        return !stanje.playerTromedje.some((t) => deliZajednickuIvicu(fields, t.fields));
      });
  }

  function iscrtajMestaZaSelo() {
    if (!stanje.settlementBuildMode) return;
    const boardEl = document.getElementById("board");
    dostupnaMestaZaSelo().forEach(({ idx }) => {
      const pos = pozicijaTemena(idx);
      if (!pos) return;
      const slot = document.createElement("div");
      slot.className = "settlement-slot";
      slot.style.left = `${pos.x}px`;
      slot.style.top = `${pos.y}px`;
      slot.onclick = () => sagradiSeloVisestruko(idx);
      boardEl.appendChild(slot);
    });
  }

  function nacrtajPut(edgeVertices, color, clickable, onClick) {
    const boardEl = document.getElementById("board");
    const [triA, triB] = edgeVertices;
    const posA = pozicijaTemena(triA);
    const posB = pozicijaTemena(triB);
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

  function obradiIzborResursa(idx, res) {
    if (VISE_IGRACA && !stanje.isCreator) return;
    if (stanje.tiles[idx]) return;
    if (stanje.counts[res] >= maksResursa[res]) {
      alert(`Nema više ${res}`);
      return;
    }
    stanje.tiles[idx] = res;
    stanje.counts[res] += 1;
    iscrtajTablu();
  }

  function baciKockuIDodeliBrojeve() {
    if (stanje.tiles.includes(null)) return alert("Popuni sva polja!");
    const dice = baciJednuKocku();
    stanje.rolled = dice;
    document.getElementById("setup-roll-result").textContent = `Pao broj: ${dice}`;

    const pocetniUgao = indeksiUglova[dice - 1];
    const pocetniIndeksSpoljnog = spoljniPrsten.indexOf(pocetniUgao);
    const rotiraniSpoljniPrsten = spoljniPrsten.slice(pocetniIndeksSpoljnog).concat(spoljniPrsten.slice(0, pocetniIndeksSpoljnog));

    let indeksBroja = 0;
    const noviBrojevi = Array(19).fill(null);
    rotiraniSpoljniPrsten.forEach((idx) => {
      if (stanje.tiles[idx] !== "pustinja") noviBrojevi[idx] = zetoniBrojeva[indeksBroja++];
    });

    const rotiraniUnutrasnjiPrsten = unutrasnjiPrsten.concat(unutrasnjiPrsten).slice(dice % 6, (dice % 6) + 6);
    rotiraniUnutrasnjiPrsten.forEach((idx) => {
      if (stanje.tiles[idx] !== "pustinja") noviBrojevi[idx] = zetoniBrojeva[indeksBroja++];
    });
    if (stanje.tiles[center] !== "pustinja") noviBrojevi[center] = zetoniBrojeva[indeksBroja++];

    stanje.numbers = noviBrojevi;
    iscrtajTablu();

    if (VISE_IGRACA) {
      document.getElementById("btn-submit-board").style.display = "inline-block";
    } else {
      udjiUFazuBiranjaLokalno();
    }
  }

  async function posaljiTablu() {
    try {
      await pozoviApi(`/games/${stanje.gameId}/setup-board`, {
        method: "POST",
        body: JSON.stringify({ tiles: stanje.tiles, numbers: stanje.numbers }),
      });
      document.getElementById("setup-controls").style.display = "none";
    } catch (e) {
      alert("Greška: " + e.message);
    }
  }

  function deliZajednickuIvicu(fieldsA, fieldsB) {
    const common = fieldsA.filter((f) => fieldsB.includes(f));
    return common.length >= 2;
  }

  function dostupneTromedje() {
    return tromedje
      .map((fields, idx) => ({ idx, fields }))
      .filter(({ fields }) => !stanje.playerTromedje.some((t) => deliZajednickuIvicu(fields, t.fields)));
  }

  // Isti algoritam kao na serveru: koje ivice smem da gradim (nadovezuju se na moje
  // selo ili moj postojeci put, a ne prolaze kroz tudje selo).
    function dostupniPutevi() {
    const myId = podesavanja.currentUserId;
    const mySettlementVertIndices = new Set(stanje.playerTromedje.filter((t) => t.id === myId).map((t) => t.tri_index));
    const enemySettlementVertIndices = new Set(stanje.playerTromedje.filter((t) => t.id !== myId).map((t) => t.tri_index));
    const builtSet = new Set(stanje.roads.map((r) => r.edge_index));

    // Vertex indeksi (tromedje indeksi) na krajevima mojih vec izgradjenih puteva.
    const myRoadVertIndices = new Set(
      stanje.roads.filter((r) => r.id === myId).flatMap((r) => ivice[r.edge_index])
    );

    return ivice
      .map((e, idx) => ({ idx, e }))
      .filter(({ idx, e }) => {
        if (builtSet.has(idx)) return false;
        return e.some((indeksTemena) => {
          const isMySettlement = mySettlementVertIndices.has(indeksTemena);
          const isEnemySettlement = enemySettlementVertIndices.has(indeksTemena);
          const isMyRoadEnd = myRoadVertIndices.has(indeksTemena) && !isEnemySettlement;
          return isMySettlement || isMyRoadEnd;
        });
      });
  }

  function opisiTromedju(fields) {
    return fields
      .map((idx) => {
        const res = stanje.tiles[idx];
        const num = stanje.numbers[idx];
        const emoji = emojiResursa[res] || "?";
        return num ? `${emoji}${num}` : `${emoji}`;
      })
      .join(" · ");
  }

  // biranje vise igraca
    function iscrtajBiranjeVisestruko() {
    const turnInfo = document.getElementById("turn-indicator");
    const listEl = document.getElementById("tromedje-list");
    const totalPicks = stanje.turnOrder.length * 2;
    const currentUserId = stanje.turnOrder[stanje.pickTurnIndex % stanje.turnOrder.length];
    const mojPotez = currentUserId === podesavanja.currentUserId;

    if (stanje.pickSubPhase === "road") {
      turnInfo.textContent = mojPotez
        ? `🎯 Sad izgradi put pored svog novog sela (${stanje.pickTurnIndex + 1}/${totalPicks})`
        : `⏳ Na potezu: ${imeIgraca(currentUserId)} gradi put (${stanje.pickTurnIndex + 1}/${totalPicks}) — čekaj svoj red...`;
      listEl.innerHTML = "";
      return;
    }

    turnInfo.textContent = mojPotez
      ? `🎯 Na tebi je red da izabereš selo (${stanje.pickTurnIndex + 1}/${totalPicks})`
      : `⏳ Na potezu: ${imeIgraca(currentUserId)} (${stanje.pickTurnIndex + 1}/${totalPicks}) — čekaj svoj red...`;

    listEl.innerHTML = "";
    dostupneTromedje().forEach(({ idx, fields }) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.textContent = `Selo #${idx + 1}: ${opisiTromedju(fields)}`;
      btn.disabled = !mojPotez;
      btn.onclick = () => izaberiTromedjuVisestruko(idx);
      li.appendChild(btn);
      listEl.appendChild(li);
    });
  }

  async function izaberiTromedjuVisestruko(indeksTemena) {
    try {
      const game = await pozoviApi(`/games/${stanje.gameId}/pick`, {
        method: "POST",
        body: JSON.stringify({ tri_index: indeksTemena }),
      });
      primeniStanjeSaServera(game);
    } catch (e) {
      alert("Greška: " + e.message);
    }
  }

    
  function iscrtajIgranjeVisestruko() {
    const currentUserId = stanje.turnOrder[stanje.playTurnIndex % stanje.turnOrder.length];
    const mojPotez = currentUserId === podesavanja.currentUserId;
    const turnEl = document.getElementById("turn-indicator-playing");
    const idOnihKojiCekaju = Object.keys(stanje.mustDiscard || {});

    if (idOnihKojiCekaju.length > 0) {
      const names = idOnihKojiCekaju.map((id) => imeIgraca(Number(id))).join(", ");
      turnEl.textContent = `⚠️ Pala je 7! Čeka se odbacivanje karata: ${names}`;
      document.getElementById("dice-icon").style.display = "none";
      document.getElementById("btn-next-turn").style.display = "none";
      document.getElementById("btn-build-road").style.display = "none";
      document.getElementById("btn-build-settlement").style.display = "none";
      document.getElementById("btn-build-city").style.display = "none";
      document.getElementById("btn-trade-resources").style.display = "none";
      document.getElementById("trade-panel").style.display = "none";
      iscrtajPanelOdbacivanja();
      return;
    }

    document.getElementById("discard-panel").style.display = "none";

    if (!mojPotez) {
      turnEl.textContent = `⏳ Na potezu: ${imeIgraca(currentUserId)} — čeka se...`;
    } else if (!stanje.hasRolledThisTurn) {
      turnEl.textContent = "🎯 Ti si na potezu — baci kockicu!";
    } else {
      turnEl.textContent = "🎯 Ti si na potezu";
    }

    document.getElementById("dice-icon").style.display = mojPotez && !stanje.hasRolledThisTurn ? "block" : "none";
    document.getElementById("btn-next-turn").style.display = mojPotez && stanje.hasRolledThisTurn ? "inline-block" : "none";
    document.getElementById("btn-build-road").style.display = mojPotez && stanje.hasRolledThisTurn ? "inline-block" : "none";
    document.getElementById("btn-build-settlement").style.display = mojPotez && stanje.hasRolledThisTurn ? "inline-block" : "none";
    document.getElementById("btn-build-city").style.display = mojPotez && stanje.hasRolledThisTurn ? "inline-block" : "none";
    document.getElementById("btn-trade-resources").style.display = mojPotez && stanje.hasRolledThisTurn ? "inline-block" : "none";

    if (!mojPotez || !stanje.hasRolledThisTurn) {
      stanje.roadBuildMode = false;
      stanje.settlementBuildMode = false;
      stanje.cityBuildMode = false;
      document.getElementById("trade-panel").style.display = "none";
    }
  }

  function iscrtajPanelOdbacivanja() {
    const panel = document.getElementById("discard-panel");
    const myRequired = stanje.mustDiscard[podesavanja.currentUserId];
    if (myRequired === undefined) {
      panel.style.display = "none";
      return;
    }
    const me = stanje.players.find((p) => p.id === podesavanja.currentUserId);
    panel.style.display = "flex";
    document.getElementById("discard-info").textContent = `Moraš odbaciti ${myRequired} resursa:`;
    ["drvo", "ovca", "psenica", "cigla", "kamen"].forEach((res) => {
      const input = document.getElementById(`discard-${res}`);
      const max = me ? me.resources[res] || 0 : 0;
      input.max = max;
      if (Number(input.value) > max) input.value = max;
    });
  }

  async function potvrdiOdbacivanje() {
    const resources = {};
    ["drvo", "ovca", "psenica", "cigla", "kamen"].forEach((res) => {
      resources[res] = Number(document.getElementById(`discard-${res}`).value) || 0;
    });
    try {
      const game = await pozoviApi(`/games/${stanje.gameId}/discard`, {
        method: "POST",
        body: JSON.stringify({ resources }),
      });
      primeniStanjeSaServera(game);
    } catch (e) {
      alert("Greška: " + e.message);
    }
  }

  async function baciKockuVisestruko() {
    const ikonicaKocke = document.getElementById("dice-icon");
    ikonicaKocke.classList.add("dice-shake");
    setTimeout(() => ikonicaKocke.classList.remove("dice-shake"), 500);

    try {
      const game = await pozoviApi(`/games/${stanje.gameId}/roll`, { method: "POST" });
      primeniStanjeSaServera(game);
    } catch (e) {
      alert("Greška: " + e.message);
    }
  }

  function prebaciRezimGradnjePuta() {
    stanje.roadBuildMode = !stanje.roadBuildMode;
    iscrtajTablu();
  }

  async function sagradiPutVisestruko(indeksIvice) {
    try {
      const game = await pozoviApi(`/games/${stanje.gameId}/build-road`, {
        method: "POST",
        body: JSON.stringify({ edge_index: indeksIvice }),
      });
      stanje.roadBuildMode = false;
      primeniStanjeSaServera(game);
    } catch (e) {
      alert("Greška: " + e.message);
    }
  }

  function prebaciRezimGradnjeSela() {
    stanje.settlementBuildMode = !stanje.settlementBuildMode;
    iscrtajTablu();
  }

  async function sagradiSeloVisestruko(indeksTemena) {
    try {
      const game = await pozoviApi(`/games/${stanje.gameId}/build-settlement`, {
        method: "POST",
        body: JSON.stringify({ tri_index: indeksTemena }),
      });
      stanje.settlementBuildMode = false;
      primeniStanjeSaServera(game);
    } catch (e) {
      alert("Greška: " + e.message);
    }
  }

  function prebaciRezimGradnjeGrada() {
    stanje.cityBuildMode = !stanje.cityBuildMode;
    iscrtajTablu();
  }

  async function izgradiGradVisestruko(indeksTemena) {
    try {
      const game = await pozoviApi(`/games/${stanje.gameId}/build-city`, {
        method: "POST",
        body: JSON.stringify({ tri_index: indeksTemena }),
      });
      stanje.cityBuildMode = false;
      primeniStanjeSaServera(game);
    } catch (e) {
      alert("Greška: " + e.message);
    }
  }

  function prebaciPanelRazmene() {
    const panel = document.getElementById("trade-panel");
    panel.style.display = panel.style.display === "none" ? "flex" : "none";
  }

  async function potvrdiRazmenu() {
    const give = document.getElementById("trade-give").value;
    const get = document.getElementById("trade-get").value;
    if (give === get) return alert("Izaberi različite resurse.");
    try {
      const game = await pozoviApi(`/games/${stanje.gameId}/trade`, {
        method: "POST",
        body: JSON.stringify({ give, get }),
      });
      document.getElementById("trade-panel").style.display = "none";
      primeniStanjeSaServera(game);
    } catch (e) {
      alert("Greška: " + e.message);
    }
  }



  async function zavrsiPotezVisestruko() {
    try {
      const game = await pozoviApi(`/games/${stanje.gameId}/end-turn`, { method: "POST" });
      stanje.roadBuildMode = false;
      primeniStanjeSaServera(game);
    } catch (e) {
      alert("Greška: " + e.message);
    }
  }

  //VISE_IGRACA: primeni stanje dobijeno sa servera
    function primeniStanjeSaServera(game) {
    stanje.createdBy = game.created_by;
    stanje.isCreator = game.created_by === podesavanja.currentUserId;

    stanje.players = game.players.map((p) => ({
      id: p.id,
      name: p.username,
      resources: Object.assign({ drvo: 0, ovca: 0, psenica: 0, cigla: 0, kamen: 0 }, p.resources || {}),
    }));

    if (game.status === "finished") {
      prikaziKrajIgre(game);
      return;
    }

    const bs = game.board_state;

    if (!bs) {
      stanje.phase = "waiting-setup";      document.getElementById("setup-controls").style.display = stanje.isCreator ? "block" : "none";
      document.getElementById("waiting-host-msg").style.display = stanje.isCreator ? "none" : "block";
      document.getElementById("picking-controls").style.display = "none";
      document.getElementById("game-controls").style.display = "none";
      iscrtajTablu();
      return;
    }

    stanje.tiles = bs.tiles;
    stanje.numbers = bs.numbers;
    stanje.turnOrder = bs.turnOrder || [];
    stanje.pickTurnIndex = bs.pickTurnIndex || 0;
    stanje.pickSubPhase = bs.pickSubPhase || "settlement";
    stanje.pendingRoadVertex = bs.pendingRoadVertex ?? null;
    stanje.playTurnIndex = bs.playTurnIndex || 0;
    stanje.hasRolledThisTurn = bs.hasRolledThisTurn || false;
    stanje.mustDiscard = bs.mustDiscard || {};
    stanje.playerTromedje = bs.playerTromedje || [];
    stanje.roads = bs.roads || [];
    stanje.log = bs.log || [];
    stanje.phase = bs.phase;

    document.getElementById("setup-controls").style.display = "none";
    document.getElementById("waiting-host-msg").style.display = "none";

    if (bs.phase === "picking") {
      document.getElementById("picking-controls").style.display = "block";
      document.getElementById("game-controls").style.display = "none";
      document.getElementById("btn-start-game").style.display = "none";
      iscrtajBiranjeVisestruko();
    } else if (bs.phase === "playing") {
      document.getElementById("picking-controls").style.display = "none";
      document.getElementById("game-controls").style.display = "block";
      iscrtajIgrace();
      iscrtajIstorijuBacanja();
      iscrtajIgranjeVisestruko();
    }

    iscrtajTablu();
  }

  function prikaziKrajIgre(game) {
    document.getElementById("setup-controls").style.display = "none";
    document.getElementById("waiting-host-msg").style.display = "none";
    document.getElementById("picking-controls").style.display = "none";
    document.getElementById("game-controls").style.display = "none";

    const winnerId = game.board_state ? game.board_state.winnerId : null;
    const winnerName = winnerId ? imeIgraca(winnerId) : "?";
    document.getElementById("game-over-text").textContent = `🏆 Pobednik: ${winnerName}!`;
    document.getElementById("game-over-overlay").style.display = "flex";
  }



  async function petljaOsvezavanja() {
    if (!VISE_IGRACA) return;
    try {
      const game = await pozoviApi(`/games/${stanje.gameId}`);
      primeniStanjeSaServera(game);
    } catch (e) {
      console.warn("Greška pri osvežavanju partije:", e);
    }
    setTimeout(petljaOsvezavanja, 1000);
  }

  // HOTSEAT (bez lobija - lokalna simulacija, bez sistema puteva) 
  function napraviRedosledBiranja() {
    const ids = stanje.players.map((p) => p.id);
    return [...ids, ...[...ids].reverse()];
  }

  function udjiUFazuBiranjaLokalno() {
    stanje.phase = "picking";
    stanje.pickOrderHotseat = napraviRedosledBiranja();
    stanje.currentPickIndex = 0;
    stanje.playerTromedje = [];

    document.getElementById("setup-controls").style.display = "none";
    document.getElementById("picking-controls").style.display = "block";
    iscrtajBiranjeLokalno();
  }

  function iscrtajBiranjeLokalno() {
    const turnInfo = document.getElementById("turn-indicator");
    const listEl = document.getElementById("tromedje-list");
    const startBtn = document.getElementById("btn-start-game");

    if (stanje.currentPickIndex >= stanje.pickOrderHotseat.length) {
      stanje.phase = "ready";
      turnInfo.textContent = "✅ Svi tereni su izabrani. Klikni „Počni igru“.";
      listEl.innerHTML = "";
      startBtn.style.display = "inline-block";
      iscrtajTablu();
      return;
    }

    const currentPlayerId = stanje.pickOrderHotseat[stanje.currentPickIndex];
    turnInfo.textContent = `🎯 Na potezu: ${imeIgraca(currentPlayerId)} — izaberi teren (${stanje.currentPickIndex + 1}/${stanje.pickOrderHotseat.length})`;
    startBtn.style.display = "none";

    listEl.innerHTML = "";
    dostupneTromedje().forEach(({ idx, fields }) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.textContent = `Teren #${idx + 1}: ${opisiTromedju(fields)}`;
      btn.onclick = () => izaberiTromedjuLokalno(idx);
      li.appendChild(btn);
      listEl.appendChild(li);
    });

    iscrtajTablu();
  }

  function izaberiTromedjuLokalno(indeksTemena) {
    const currentPlayerId = stanje.pickOrderHotseat[stanje.currentPickIndex];
    const fields = tromedje[indeksTemena];
    stanje.playerTromedje.push({ id: currentPlayerId, fields });

    const brojevi = fields.map((idx) => stanje.numbers[idx]).filter((n) => n !== null);
    stanje.log = [`${imeIgraca(currentPlayerId)} je izabrao teren: brojevi ${brojevi.join(", ")}`, ...stanje.log].slice(0, 4);

    stanje.currentPickIndex += 1;
    iscrtajBiranjeLokalno();
  }

  async function zavrsiPripremuLokalno() {
    if (stanje.phase !== "ready") return;
    stanje.phase = "playing";

    document.getElementById("picking-controls").style.display = "none";
    document.getElementById("game-controls").style.display = "block";
    stanje.currentTurnIndex = 0;
    iscrtajIgrace();
    iscrtajIstorijuBacanja();
    iscrtajTablu();
    iscrtajPotezLokalno();

    try {
      const game = await pozoviApi("/games", {
        method: "POST",
        body: JSON.stringify({ board_state: { tiles: stanje.tiles, numbers: stanje.numbers, playerTromedje: stanje.playerTromedje } }),
      });
      stanje.gameId = game.id;
    } catch (e) {
      console.warn("Nije moguće sačuvati partiju na serveru:", e);
    }
  }

  function iscrtajPotezLokalno() {
    const player = stanje.players[stanje.currentTurnIndex];
    document.getElementById("turn-indicator-playing").textContent = `🎯 Na potezu: ${player ? player.name : "?"}`;
    document.getElementById("dice-icon").style.display = "block";
    document.getElementById("btn-next-turn").style.display = "none";
  }

  function sledeciPotezLokalno() {
    stanje.currentTurnIndex = (stanje.currentTurnIndex + 1) % stanje.players.length;
    iscrtajPotezLokalno();
  }

  async function baciKockuLokalno() {
    if (document.getElementById("dice-icon").style.display === "none") return;

    const ikonicaKocke = document.getElementById("dice-icon");
    ikonicaKocke.classList.add("dice-shake");
    setTimeout(() => ikonicaKocke.classList.remove("dice-shake"), 500);

    let dice;
    try {
      const result = stanje.gameId ? await pozoviApi(`/games/${stanje.gameId}/roll`, { method: "POST" }) : null;
      dice = result ? result.roll || baciJednuKocku() + baciJednuKocku() : baciJednuKocku() + baciJednuKocku();
    } catch (e) {
      dice = baciJednuKocku() + baciJednuKocku();
    }
    stanje.log = [`Dobijen je broj ${dice}`, ...stanje.log].slice(0, 4);
    stanje.rolled = dice;

    stanje.players = stanje.players.map((p) => {
      const upd = { ...p, resources: { ...p.resources } };
      stanje.playerTromedje
        .filter((t) => t.id === p.id)
        .forEach((trom) => {
          trom.fields.forEach((idx) => {
            if (stanje.numbers[idx] === dice && stanje.tiles[idx] && stanje.tiles[idx] !== "pustinja") {
              upd.resources[stanje.tiles[idx]] += 1;
            }
          });
        });
      return upd;
    });

    iscrtajIgrace();
    iscrtajIstorijuBacanja();

    document.getElementById("dice-icon").style.display = "none";
    document.getElementById("btn-next-turn").style.display = "inline-block";
  }

    function izracunajPoene(playerId) {
    return stanje.playerTromedje
      .filter((t) => t.id === playerId)
      .reduce((sum, t) => sum + (t.type === "city" ? 2 : 1), 0);
  }

  function iscrtajIgrace() {
    const el = document.getElementById("player-info");
    el.innerHTML = "";
    const visiblePlayers = VISE_IGRACA ? stanje.players.filter((p) => p.id === podesavanja.currentUserId) : stanje.players;
    visiblePlayers.forEach((p) => {
      const box = document.createElement("div");
      box.className = "player-box";
      box.innerHTML = `<h3 style="margin:0">${p.name} — 🏆 ${izracunajPoene(p.id)} poena</h3>
        <p>🌲 ${p.resources.drvo || 0} 🐑 ${p.resources.ovca || 0} 🌾 ${p.resources.psenica || 0} 🧱 ${p.resources.cigla || 0} 🪨 ${p.resources.kamen || 0}</p>`;
      el.appendChild(box);
    });
  }

  function iscrtajIstorijuBacanja() {
    const el = document.getElementById("roll-log-list");
    el.innerHTML = "";
    stanje.log.forEach((entry) => {
      const li = document.createElement("li");
      li.textContent = entry;
      el.appendChild(li);
    });
  }

  async function sacuvajPartiju() {
    if (!stanje.gameId) return alert("Prvo pokreni partiju.");
    try {
      await pozoviApi(`/games/${stanje.gameId}`, {
        method: "PUT",
        body: JSON.stringify({ board_state: { tiles: stanje.tiles, numbers: stanje.numbers, playerTromedje: stanje.playerTromedje, players: stanje.players, log: stanje.log } }),
      });
      alert("✅ Partija sačuvana.");
    } catch (e) {
      alert("❌ Greška pri čuvanju.");
    }
  }



  document.getElementById("btn-roll-setup").addEventListener("click", baciKockuIDodeliBrojeve);
  document.getElementById("dice-icon").addEventListener("click", VISE_IGRACA ? baciKockuVisestruko : baciKockuLokalno);
  document.getElementById("btn-finish-game").addEventListener("click", () => {
    window.location.href = "/";
  });
  document.getElementById("btn-save").addEventListener("click", sacuvajPartiju);
  document.getElementById("btn-next-turn").addEventListener("click", VISE_IGRACA ? zavrsiPotezVisestruko : sledeciPotezLokalno);

  if (VISE_IGRACA) {
    document.getElementById("btn-submit-board").addEventListener("click", posaljiTablu);
    document.getElementById("btn-build-road").addEventListener("click", prebaciRezimGradnjePuta);
    document.getElementById("btn-build-settlement").addEventListener("click", prebaciRezimGradnjeSela);
    document.getElementById("btn-build-city").addEventListener("click", prebaciRezimGradnjeGrada);
    document.getElementById("btn-trade-resources").addEventListener("click", prebaciPanelRazmene);
    document.getElementById("btn-confirm-trade").addEventListener("click", potvrdiRazmenu);
    document.getElementById("btn-confirm-discard").addEventListener("click", potvrdiOdbacivanje);
    document.getElementById("btn-load").style.display = "none";
    document.getElementById("btn-save").style.display = "none";
    petljaOsvezavanja();
  } else {
    document.getElementById("btn-start-game").addEventListener("click", zavrsiPripremuLokalno);
    document.getElementById("btn-build-road").style.display = "none";
    document.getElementById("btn-build-settlement").style.display = "none";
    document.getElementById("btn-build-city").style.display = "none";
    document.getElementById("btn-trade-resources").style.display = "none";
    document.getElementById("btn-load").addEventListener("click", async () => {
      if (!stanje.gameId) return alert("Nema aktivne partije za učitavanje.");
      try {
        const game = await pozoviApi(`/games/${stanje.gameId}`);
        const bs = game.board_state || {};
        stanje.tiles = bs.tiles || stanje.tiles;
        stanje.numbers = bs.numbers || stanje.numbers;
        stanje.playerTromedje = bs.playerTromedje || stanje.playerTromedje;
        stanje.players = bs.players || stanje.players;
        stanje.log = bs.log || stanje.log;
        iscrtajTablu();
        iscrtajIgrace();
        iscrtajIstorijuBacanja();
        alert("✅ Partija učitana.");
      } catch (e) {
        alert("❌ Greška pri učitavanju.");
      }
    });
    iscrtajTablu();
  }
})();