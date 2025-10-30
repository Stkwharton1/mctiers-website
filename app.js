// Client-side script: server-status integration.
// Replace the value of serverToCheck with your server IP or IP:PORT (e.g. "play.example.com" or "play.example.com:25565")
const serverToCheck = "lightvanilla.qzz.io"; // <-- REPLACE THIS

function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

async function fetchServerStatus(host) {
  try {
    // Using mcsrvstat public API - no auth required.
    // Example: https://api.mcsrvstat.us/2/play.example.com
    const url = `https://api.mcsrvstat.us/2/${encodeURIComponent(host)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Network response not ok");
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Server status fetch error:", err);
    return null;
  }
}

async function updateServerCard() {
  setText("year", new Date().getFullYear());
  const data = await fetchServerStatus(serverToCheck);
  const connectLink = document.getElementById("srv-connect");
  if (!data) {
    setText("srv-name", "Unable to fetch status");
    setText("srv-motd", "");
    setText("srv-online", "Unknown");
    setText("srv-players", "—");
    if (connectLink) {
      connectLink.textContent = `Connect: ${serverToCheck}`;
      connectLink.href = `minecraft:///${serverToCheck}`;
    }
    return;
  }

  // mcsrvstat.us returns 'online' boolean and players object {online:number, max:number} plus motd array
  const online = data.online === true;
  setText("srv-online", online ? "Online" : "Offline");
  const players = (data.players && typeof data.players.online === "number") ? `${data.players.online}/${data.players.max || "?"}` : "—";
  setText("srv-players", players);

  // MOTD: prefer clean version if available
  let motd = "";
  if (data.motd && data.motd.clean && data.motd.clean.length) {
    motd = data.motd.clean.join(" ").trim();
  } else if (data.motd && data.motd.raw && data.motd.raw.length) {
    motd = data.motd.raw.join(" ").trim();
  }
  setText("srv-motd", motd || "—");

  // Name
  setText("srv-name", data.hostname || hostDisplayName(host));

  if (connectLink) {
    connectLink.textContent = `Connect: ${host}`;
    connectLink.href = `minecraft:///${host}`;
  }
}

function hostDisplayName(host) {
  return host;
}

document.addEventListener("DOMContentLoaded", updateServerCard);