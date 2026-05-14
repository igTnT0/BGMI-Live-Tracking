const API_URL = "https://script.google.com/macros/s/AKfycbyTX5H9J45Lbrr26XG-VVjkcVEgduLwzThihNqk-Tz4wVJTkIOLfrnVrBJI-h21Sy7V/exec";

const ROW_HEIGHT = 42;
const POLL_MS = 400;

let prevBoard = new Map();
let firstLoadDone = false;
let lastFeedKeyShown = "";
let activeRequestId = 0;
let latestRenderedRequestId = 0;
let isRequestInFlight = false;

function load() {
  if (isRequestInFlight) return;

  isRequestInFlight = true;
  activeRequestId += 1;
  const requestId = activeRequestId;

  const oldScript = document.getElementById("jsonpScript");
  if (oldScript) oldScript.remove();

  const script = document.createElement("script");
  script.id = "jsonpScript";
  script.src = API_URL + "?callback=overlayCallback&t=" + Date.now() + "&rid=" + requestId;

  script.onerror = function () {
    // keep as backup only
    setTimeout(() => {
      isRequestInFlight = false; 
    }, 1500);
  };

  script.onerror = function () {
    isRequestInFlight : false;
    console.error("API load failed");
  };
  document.body.appendChild(script);
}
    
function teamKey(team) {
  return String(team.teamTag || "");
}

function createBars(alive, knocked, dead) {
  const parts = [];

  for (let i = 0; i < alive; i++) {
    parts.push('<span class="bar alive"></span>');
  }
  for (let i = 0; i < knocked; i++) {
    parts.push('<span class="bar knocked"></span>');
  }
  for (let i = 0; i < dead; i++) {
    parts.push('<span class="bar dead"></span>');
  }

  return `<div class="bar-wrap">${parts.join("")}</div>`;
}

function makeRow(team) {
  const row = document.createElement("div");
  row.className = "row";
  row.dataset.key = teamKey(team);

  if (team.alive === 0) {
    row.classList.add("eliminated");
  } else if (team.blueZone) {
    row.classList.add("blue-zone");
  }

  row.innerHTML = `
    <div class="col left-rank">${team.rank}</div>
    <div class="col left-team">
      <div class="team-wrap">
        <img class="team-logo" src="${team.logo || ""}" alt="" onerror="this.style.display='none'">
        <div class="team-tag">${team.teamTag || ""}</div>
      </div>
    </div>
    <div class="col right-elims">${team.elims}</div>
    <div class="col right-pts">${team.pts}</div>
    <div class="col right-status">${createBars(team.alive, team.knocked, team.dead)}</div>
  `;

  return row;
}

function applyRowContent(row, team) {
  row.children[0].textContent = team.rank;

  row.children[1].innerHTML = `
    <div class="team-wrap">
      <img class="team-logo" src="${team.logo || ""}" alt="" onerror="this.style.display='none'">
      <div class="team-tag">${team.teamTag || ""}</div>
    </div>
  `;

  row.children[2].textContent = team.elims;
  row.children[3].textContent = team.pts;
  row.children[4].innerHTML = createBars(team.alive, team.knocked, team.dead);

  row.classList.remove("blue-zone", "eliminated", "rank-up", "rank-down");

  if (team.alive === 0) {
    row.classList.add("eliminated");
  } else if (team.blueZone) {
    row.classList.add("blue-zone");
  }
}

function overlayCallback(payload) {
  isRequestInFlight = false;

  if (!payload || !Array.isArray(payload.board)) return;
  
  latestRenderedRequestId = activeRequestId;

  if (payload.board.length > 0) {
    renderBoard(payload.board);
  }
  
  renderFeed(Array.isArray(payload.feed) ? payload.feed : []);
}

function renderBoard(data) {
  const board = document.getElementById("board");
  if (!board) return;

  board.style.height = `${Math.max(data.length, 1) * ROW_HEIGHT}px`;

  if (!firstLoadDone) {
    board.innerHTML = "";
    data.forEach((team, i) => {
      const row = makeRow(team);
      row.style.transform = `translateY(${i * ROW_HEIGHT}px)`;
      row.style.opacity = "1";
      board.appendChild(row);
    });
    prevBoard = new Map(data.map(t => [teamKey(t), t]));
    firstLoadDone = true;
    return;
  }

  const incomingKeys = new Set(data.map(team => teamKey(team)));

  const existingRows = new Map(
    Array.from(board.querySelectorAll(".row")).map(row => [row.dataset.key, row])
  );

  data.forEach((team, i) => {
    const key = teamKey(team);
    let row = existingRows.get(key);
    const old = prevBoard.get(key);

    if (!row) {
      row = makeRow(team);
      row.style.opacity = "0";
      row.style.transform = `translateY(${i * ROW_HEIGHT + 6}px)`;
      board.appendChild(row);

      requestAnimationFrame(() => {
        row.style.opacity = "1";
        row.style.transform = `translateY(${i * ROW_HEIGHT}px)`;
      });
    } else {
      const oldRank = old ? Number(old.rank) : Number(team.rank);
      const changed =
        !old ||
        String(old.rank) !== String(team.rank) ||
        String(old.pts) !== String(team.pts) ||
        String(old.elims) !== String(team.elims) ||
        String(old.alive) !== String(team.alive) ||
        String(old.knocked) !== String(team.knocked) ||
        String(old.dead) !== String(team.dead) ||
        String(old.blueZone) !== String(team.blueZone) ||
        String(old.logo) !== String(team.logo);

      applyRowContent(row, team);
      row.style.opacity = "1";
      row.style.transform = `translateY(${i * ROW_HEIGHT}px)`;

      if (changed) {
        row.classList.add("updated-row");
        setTimeout(() => row.classList.remove("updated-row"), 800);
      }

      if (old && Number(team.rank) < oldRank) {
        row.classList.add("rank-up");
        setTimeout(() => row.classList.remove("rank-up"), 700);
      } else if (old && Number(team.rank) > oldRank) {
        row.classList.add("rank-down");
        setTimeout(() => row.classList.remove("rank-down"), 700);
      }
    }
  });

  existingRows.forEach((row, key) => {
    if (!incomingKeys.has(key)) {
      row.style.opacity = "0";
      setTimeout(() => {
        if (row.parentNode) row.remove();
      }, 220);
    }
  });

  prevBoard = new Map(data.map(t => [teamKey(t), t]));
}

function renderFeed(feed) {
  const container = document.getElementById("killFeed");
  if (!container) return;

  const newest = feed && feed.length ? feed[0] : null;

  if (!newest) {
    container.innerHTML = "";
    lastFeedKeyShown = "";
    return;
  }

  const newKey = `${newest.time || ""}|${newest.logo || ""}|${newest.elims || 0}|${newest.placePts || 0}`;
  if (newKey === lastFeedKeyShown) return;

  container.innerHTML = `
    <div class="killcard killcard-new">
      <div class="killcard-rank">${newest.time || "#16"}</div>

      <div class="killcard-left">
        <img class="killcard-logo" src="${newest.logo || ""}" alt="" onerror="this.style.display='none'">
      </div>

      <div class="killcard-right">
        <div class="killcard-stats">
          <div class="killcard-stat">
            <div class="killcard-stat-number">${Number(newest.elims) || 0}</div>
            <div class="killcard-stat-label">KILLS</div>
          </div>

          <div class="killcard-divider"></div>

          <div class="killcard-stat">
            <div class="killcard-stat-number">${Number(newest.placePts) || 0}</div>
            <div class="killcard-stat-label">PLACE PTS.</div>
          </div>
        </div>

        <div class="killcard-eliminated">ELIMINATED</div>
      </div>
    </div>
  `;

  lastFeedKeyShown = newKey;
}

setInterval(load, POLL_MS);
load();