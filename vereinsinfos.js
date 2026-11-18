const infoDbHost = "https://kalendertsv-default-rtdb" + ".europe-west1.firebasedatabase.app";

let aktuelleNewsDaten = {
  titel: "Willkommen im neuen TSV Kalender",
  kurztext: "Alle Trainingszeiten, Spiele und Vereins-News ab sofort live auf einen Blick.",
  volltext: "Herzlich willkommen in unserer digitalen Vereins-App! Hier findest du immer aktuell alle Termine deiner Mannschaft sowie wichtige Neuigkeiten rund um den TSV.",
  icon: "⚽"
};

let sponsorenListe = [];
let aktuellerSponsorIndex = 0;
let sponsorTimer = null;

async function ladeVereinsInfos() {
  // Sofort Standard-Banner zeichnen, damit nie eine Lücke entsteht
  zeichneNewsBanner();
  zeichneSponsorenBanner();

  const user = getAktuellerUser();
  if (!user) return;

  try {
    const [newsRes, sponRes] = await Promise.all([
      fetch(infoDbHost + "/news.json?auth=" + user.idToken),
      fetch(infoDbHost + "/sponsoren.json?auth=" + user.idToken)
    ]);

    if (newsRes.ok) {
      const nData = await newsRes.json();
      if (nData && nData.titel) aktuelleNewsDaten = nData;
    }

    if (sponRes.ok) {
      const sData = await sponRes.json();
      sponsorenListe = sData ? Object.keys(sData).map(id => ({ id, ...sData[id] })) : [];
    }
  } catch (e) {}

  zeichneNewsBanner();
  zeichneSponsorenBanner();
}

function zeichneNewsBanner() {
  const container = document.getElementById("news-slot");
  const user = getAktuellerUser();
  if (!container || !user) return;

  const perms = getPermissions(user.role);
  container.innerHTML = "";

  const card = document.createElement("div");
  card.className = "news-card";

  const head = document.createElement("div");
  head.className = "news-header";

  const titleH3 = document.createElement("h3");
  titleH3.textContent = "News";

  const rightControls = document.createElement("div");
  rightControls.style.cssText = "display:flex;align-items:center;gap:10px;";

  if (perms.isAdmin) {
    const editBtn = document.createElement("span");
    editBtn.textContent = "✏️";
    editBtn.style.cssText = "font-size:15px;cursor:pointer;padding:3px 7px;background:#eef4fc;border-radius:8px;";
    editBtn.onclick = (e) => {
      e.stopPropagation();
      oeffneNewsEditor();
    };
    rightControls.appendChild(editBtn);
  }

  const arrow = document.createElement("span");
  arrow.textContent = "›";
  arrow.style.cssText = "color:var(--navy);font-weight:800;font-size:18px;";
  rightControls.appendChild(arrow);

  head.append(titleH3, rightControls);

  const body = document.createElement("div");
  body.className = "news-body";

  const thumb = document.createElement("div");
  thumb.className = "news-thumb";
  thumb.textContent = aktuelleNewsDaten.icon || "⚽";

  const textDiv = document.createElement("div");
  textDiv.className = "news-text";

  const h4 = document.createElement("h4");
  h4.textContent = aktuelleNewsDaten.titel;

  const p = document.createElement("p");
  p.textContent = aktuelleNewsDaten.kurztext;

  textDiv.append(h4, p);
  body.append(thumb, textDiv);
  card.append(head, body);

  card.onclick = () => zeigeNewsVolltext();
  container.appendChild(card);
}

function zeigeNewsVolltext() {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";

  const sheet = document.createElement("div");
  sheet.className = "bottom-sheet";

  const head = document.createElement("div");
  head.className = "sheet-header";
  const h3 = document.createElement("h3");
  h3.style.cssText = "margin:0;font-size:18px;color:var(--navy);";
  h3.textContent = (aktuelleNewsDaten.icon || "⚽") + " " + aktuelleNewsDaten.titel;

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "sheet-close";
  closeBtn.textContent = "×";
  closeBtn.onclick = () => backdrop.remove();
  head.append(h3, closeBtn);

  const bodyP = document.createElement("p");
  bodyP.style.cssText = "font-size:14px;line-height:1.55;color:var(--text);white-space:pre-line;margin:0;";
  bodyP.textContent = aktuelleNewsDaten.volltext || aktuelleNewsDaten.kurztext;

  backdrop.onclick = (e) => { if (e.target === backdrop) backdrop.remove(); };
  sheet.append(head, bodyP);
  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);
}

function oeffneNewsEditor() {
  const user = getAktuellerUser();
  if (!user) return;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";

  const sheet = document.createElement("div");
  sheet.className = "bottom-sheet";

  const head = document.createElement("div");
  head.className = "sheet-header";
  const h3 = document.createElement("h3");
  h3.style.cssText = "margin:0;font-size:18px;color:var(--navy);";
  h3.textContent = "News-Banner bearbeiten";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "sheet-close";
  closeBtn.textContent = "×";
  closeBtn.onclick = () => backdrop.remove();
  head.append(h3, closeBtn);

  const iconSel = document.createElement("select");
  [
    { val: "⚽", label: "⚽ Fußball / Spielbericht" },
    { val: "🏆", label: "🏆 Turnier / Pokal" },
    { val: "📢", label: "📢 Wichtige Vereins-Info" },
    { val: "🎉", label: "🎉 Vereinsfest / Event" },
    { val: "⚠️", label: "⚠️ Platzsperre / Achtung" }
  ].forEach(ic => {
    const opt = document.createElement("option");
    opt.value = ic.val;
    opt.textContent = ic.label;
    if (ic.val === aktuelleNewsDaten.icon) opt.selected = true;
    iconSel.appendChild(opt);
  });

  const titelIn = erstelleFeld("text", "news-edit-titel", "Überschrift");
  titelIn.value = aktuelleNewsDaten.titel || "";

  const kurzIn = erstelleFeld("text", "news-edit-kurz", "Kurze Vorschau (1–2 Sätze)");
  kurzIn.value = aktuelleNewsDaten.kurztext || "";

  const vollIn = document.createElement("textarea");
  vollIn.rows = 4;
  vollIn.placeholder = "Ausführlicher Bericht (erscheint beim Antippen)...";
  vollIn.value = aktuelleNewsDaten.volltext || "";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn-success";
  saveBtn.textContent = "News veröffentlichen";

  const msg = document.createElement("p");
  msg.style.cssText = "font-size:13px;font-weight:600;margin:4px 0 0;color:var(--danger);";

  saveBtn.onclick = async () => {
    if (!titelIn.value.trim()) { msg.textContent = "Bitte Überschrift eingeben!"; return; }
    saveBtn.textContent = "Speichere...";
    const neu = {
      icon: iconSel.value,
      titel: titelIn.value.trim(),
      kurztext: kurzIn.value.trim(),
      volltext: vollIn.value.trim(),
      aktualisiertAm: new Date().toISOString()
    };
    try {
      const res = await fetch(infoDbHost + "/news.json?auth=" + user.idToken, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(neu)
      });
      if (!res.ok) throw new Error("Status " + res.status);
      aktuelleNewsDaten = neu;
      zeichneNewsBanner();
      backdrop.remove();
    } catch (e) {
      msg.textContent = "Fehler beim Speichern: " + e.message;
      saveBtn.textContent = "News veröffentlichen";
    }
  };

  backdrop.onclick = (e) => { if (e.target === backdrop) backdrop.remove(); };
  sheet.append(
    head,
    erstelleLabel("Symbol"), iconSel,
    erstelleLabel("Überschrift"), titelIn,
    erstelleLabel("Vorschautext"), kurzIn,
    erstelleLabel("Ganzer Bericht"), vollIn,
    saveBtn, msg
  );
  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);
}

function zeichneSponsorenBanner() {
  const container = document.getElementById("sponsor-slot");
  const user = getAktuellerUser();
  if (!container || !user) return;

  if (sponsorTimer) {
    clearInterval(sponsorTimer);
    sponsorTimer = null;
  }

  const liste = sponsorenListe.length > 0 ? sponsorenListe : [
    { firma: "TSV Partner", branche: "Bau & Immobilien", slogan: "Stark im Team – auf und neben dem Platz.", farbe: "linear-gradient(135deg, #09152b 0%, #16325c 60%, #14532d 100%)" }
  ];

  if (aktuellerSponsorIndex >= liste.length) aktuellerSponsorIndex = 0;

  function renderAktuellenSponsor() {
    container.innerHTML = "";
    const sp = liste[aktuellerSponsorIndex];

    const banner = document.createElement("div");
    banner.className = "sponsor-banner";
    if (sp.farbe) banner.style.background = sp.farbe;

    const logoDiv = document.createElement("div");
    logoDiv.className = "sponsor-logo";
    logoDiv.textContent = sp.firma;
    if (sp.branche) {
      const sm = document.createElement("small");
      sm.textContent = sp.branche;
      logoDiv.appendChild(sm);
    }

    const sloganDiv = document.createElement("div");
    sloganDiv.className = "sponsor-slogan";
    sloganDiv.textContent = sp.slogan;

    banner.append(logoDiv, sloganDiv);

    if (user.role === "Vorstand") {
      const manageBtn = document.createElement("button");
      manageBtn.type = "button";
      manageBtn.textContent = "⚙️";
      manageBtn.style.cssText = "width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.2);color:white;padding:0;margin:0;font-size:15px;flex-shrink:0;";
      manageBtn.onclick = (e) => {
        e.stopPropagation();
        oeffneSponsorenManager();
      };
      banner.appendChild(manageBtn);
    }

    banner.onclick = () => {
      if (liste.length > 1) {
        aktuellerSponsorIndex = (aktuellerSponsorIndex + 1) % liste.length;
        renderAktuellenSponsor();
      }
    };

    container.appendChild(banner);
  }

  renderAktuellenSponsor();

  if (liste.length > 1) {
    sponsorTimer = setInterval(() => {
      if (document.getElementById("sponsor-slot")) {
        aktuellerSponsorIndex = (aktuellerSponsorIndex + 1) % liste.length;
        renderAktuellenSponsor();
      }
    }, 5000);
  }
}

function oeffneSponsorenManager() {
  const user = getAktuellerUser();
  if (!user || user.role !== "Vorstand") return;

  const backdrop = document.createElement("div");
backdrop.className = "modal-backdrop";
const sheet = document.createElement("div");
sheet.className = "bottom-sheet";
const head = document.createElement("div");
head.className = "sheet-header";
const h3 = document.createElement("h3");
h3.style.cssText = "margin:0;font-size:18px;color:var(--navy);";
h3.textContent = "Bandenwerbung verwalten";
const closeBtn = document.createElement("button");
closeBtn.type = "button";
closeBtn.className = "sheet-close";
closeBtn.textContent = "×";
closeBtn.onclick = () => backdrop.remove();
head.append(h3, closeBtn);
sheet.appendChild(head);
const listDiv = document.createElement("div");
listDiv.style.marginBottom = "18px";
function renderPartnerListe() {
listDiv.innerHTML = "";
if (sponsorenListe.length === 0) {
const p = document.createElement("p");
p.style.cssText = "font-size:13px;color:var(--muted);margin:0;";
p.textContent = "Noch keine eigenen Werbepartner eingetragen.";
listDiv.appendChild(p);
return;
}
sponsorenListe.forEach(sp => {
const row = document.createElement("div");
row.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:10px;background:#f8fafc;border-radius:12px;margin-bottom:8px;border:1px solid var(--border);";
const info = document.createElement("div");
const stName = document.createElement("strong");
stName.style.cssText = "font-size:13px;color:var(--navy);display:block;";
stName.textContent = sp.firma;
const smText = document.createElement("small");
smText.style.color = "var(--muted)";
smText.textContent = sp.slogan;
info.append(stName, smText);
const del = document.createElement("button");
del.type = "button";
del.className = "btn-danger";
del.textContent = "Löschen";
del.style.cssText = "width:auto;padding:6px 10px;margin:0;font-size:11px;";
del.onclick = async () => {
await fetch(infoDbHost + "/sponsoren/" + sp.id + ".json?auth=" + user.idToken, { method: "DELETE" });
sponsorenListe = sponsorenListe.filter(x => x.id !== sp.id);
renderPartnerListe();
zeichneSponsorenBanner();
};
row.append(info, del);
listDiv.appendChild(row);
});
}
renderPartnerListe();
sheet.appendChild(listDiv);
const subTitle = document.createElement("h4");
subTitle.style.cssText = "margin:0 0 10px;font-size:14px;color:var(--navy);";
subTitle.textContent = "+ Neuen Werbepartner hinzufügen";
const firmaIn = erstelleFeld("text", "sp-firma", "Firmenname (z. B. Metzgerei Müller)");
const brancheIn = erstelleFeld("text", "sp-branche", "Branche / Zusatz (z. B. Partyservice)");
const sloganIn = erstelleFeld("text", "sp-slogan", "Werbespruch (z. B. Wir wünschen viel Erfolg!)");
const farbeSel = document.createElement("select");
[
{ val: "linear-gradient(135deg, #09152b 0%, #16325c 60%, #14532d 100%)", label: "Vereinsblau & Stadiongrün" },
{ val: "linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%)", label: "Kräftiges Rot" },
{ val: "linear-gradient(135deg, #064e3b 0%, #059669 100%)", label: "Smaragdgrün" },
{ val: "linear-gradient(135deg, #1e293b 0%, #334155 100%)", label: "Edles Anthrazit" },
{ val: "linear-gradient(135deg, #78350f 0%, #b45309 100%)", label: "Gold / Bronze" }
].forEach(f => {
const o = document.createElement("option");
o.value = f.val;
o.textContent = f.label;
farbeSel.appendChild(o);
});
const addBtn = document.createElement("button");
addBtn.type = "button";
addBtn.className = "btn-success";
addBtn.textContent = "Werbepartner speichern";
addBtn.onclick = async () => {
if (!firmaIn.value.trim() || !sloganIn.value.trim()) {
alert("Bitte Firmenname und Werbespruch ausfüllen!");
return;
}
addBtn.textContent = "Speichere...";
const neuerPartner = {
firma: firmaIn.value.trim(),
branche: brancheIn.value.trim(),
slogan: sloganIn.value.trim(),
farbe: farbeSel.value
};
const res = await fetch(infoDbHost + "/sponsoren.json?auth=" + user.idToken, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(neuerPartner)
});
if (res.ok) {
const data = await res.json();
sponsorenListe.push({ id: data.name, ...neuerPartner });
firmaIn.value = "";
brancheIn.value = "";
sloganIn.value = "";
renderPartnerListe();
zeichneSponsorenBanner();
}
addBtn.textContent = "Werbepartner speichern";
};
backdrop.onclick = (e) => { if (e.target === backdrop) backdrop.remove(); };
sheet.append(
subTitle,
erstelleLabel("Firmenname"), firmaIn,
erstelleLabel("Branche (optional)"), brancheIn,
erstelleLabel("Werbeslogan"), sloganIn,
erstelleLabel("Banner-Farbe"), farbeSel,
addBtn
);
backdrop.appendChild(sheet);
document.body.appendChild(backdrop);
}
