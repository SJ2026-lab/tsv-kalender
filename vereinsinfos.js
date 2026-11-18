const infoDbHost = "https://kalendertsv-default-rtdb" + ".europe-west1.firebasedatabase.app";

const STANDARD_NEWS = {
  titel: "Willkommen im neuen TSV Kalender",
  kurztext: "Alle Trainingszeiten, Spiele und Vereins-News ab sofort live auf einen Blick.",
  volltext: "Herzlich willkommen in unserer digitalen Vereins-App! Hier findest du immer aktuell alle Termine deiner Mannschaft sowie wichtige Neuigkeiten rund um den TSV.",
  bild: ""
};

let aktuelleNewsDaten = { ...STANDARD_NEWS };
let hatEigeneNews = false;

let sponsorenListe = [];
let sponsorLoopTimer = null;

function komprimiereBildDatei(file, maxBreite, qualitaet) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > maxBreite) {
          h = Math.round((h * maxBreite) / w);
          w = maxBreite;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", qualitaet));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function ladeVereinsInfos() {
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
      if (nData && nData.titel) {
        aktuelleNewsDaten = nData;
        hatEigeneNews = true;
      } else {
        aktuelleNewsDaten = { ...STANDARD_NEWS };
        hatEigeneNews = false;
      }
    }

    if (sponRes.ok) {
      const sData = await sponRes.json();
      sponsorenListe = sData ? Object.keys(sData).map(id => ({ id, ...sData[id] })) : [];
    }
  } catch (e) {}

  zeichneNewsBanner();
  zeichneSponsorenBanner();
}

// 1. News-Banner (2 Spalten: Links Bild, Rechts Text)
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

  if (aktuelleNewsDaten.bild) {
    const img = document.createElement("img");
    img.src = aktuelleNewsDaten.bild;
    thumb.appendChild(img);
  } else {
    thumb.textContent = "⚽";
  }

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
  h3.textContent = aktuelleNewsDaten.titel;

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "sheet-close";
  closeBtn.textContent = "×";
  closeBtn.onclick = () => backdrop.remove();
  head.append(h3, closeBtn);
  sheet.appendChild(head);

  if (aktuelleNewsDaten.bild) {
    const bigImg = document.createElement("img");
    bigImg.src = aktuelleNewsDaten.bild;
    bigImg.style.cssText = "width:100%;max-height:220px;object-fit:cover;border-radius:14px;margin-bottom:14px;";
    sheet.appendChild(bigImg);
  }

  const bodyP = document.createElement("p");
  bodyP.style.cssText = "font-size:14px;line-height:1.55;color:var(--text);white-space:pre-line;margin:0;";
  bodyP.textContent = aktuelleNewsDaten.volltext || aktuelleNewsDaten.kurztext;

  backdrop.onclick = (e) => { if (e.target === backdrop) backdrop.remove(); };
  sheet.appendChild(bodyP);
  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);
}

function oeffneNewsEditor() {
  const user = getAktuellerUser();
  if (!user) return;

  let gewaehltesBildBase64 = hatEigeneNews ? (aktuelleNewsDaten.bild || "") : "";

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

  const previewImg = document.createElement("img");
  previewImg.className = "img-preview-box" + (gewaehltesBildBase64 ? "" : " hidden");
  if (gewaehltesBildBase64) previewImg.src = gewaehltesBildBase64;

  const fileInput = document.createElement("in" + "put");
  fileInput.setAttribute("type", "file");
  fileInput.setAttribute("accept", "image/*");

  fileInput.onchange = async (e) => {
    const file = e.target.files.item(0);
    if (!file) return;
    gewaehltesBildBase64 = await komprimiereBildDatei(file, 500, 0.75);
    previewImg.src = gewaehltesBildBase64;
    previewImg.classList.remove("hidden");
  };

  const titelIn = erstelleFeld("text", "news-edit-titel", "Überschrift");
  titelIn.value = hatEigeneNews ? (aktuelleNewsDaten.titel || "") : "";

  const kurzIn = erstelleFeld("text", "news-edit-kurz", "Kurze Vorschau (1–2 Sätze)");
  kurzIn.value = hatEigeneNews ? (aktuelleNewsDaten.kurztext || "") : "";

  const vollIn = document.createElement("textarea");
  vollIn.rows = 4;
  vollIn.placeholder = "Ausführlicher Bericht (erscheint beim Antippen)...";
  vollIn.value = hatEigeneNews ? (aktuelleNewsDaten.volltext || "") : "";

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
      bild: gewaehltesBildBase64,
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
      hatEigeneNews = true;
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
    erstelleLabel("News-Bild auswählen"), fileInput, previewImg,
    erstelleLabel("Überschrift"), titelIn,
    erstelleLabel("Vorschautext"), kurzIn,
    erstelleLabel("Ganzer Bericht"), vollIn,
    saveBtn
  );

  if (hatEigeneNews) {
    const delNewsBtn = document.createElement("button");
    delNewsBtn.type = "button";
    delNewsBtn.className = "btn-danger";
    delNewsBtn.textContent = "Aktuelle News löschen";
    delNewsBtn.onclick = async () => {
      if (!confirm("Möchtest du die aktuelle News wirklich löschen?")) return;
      delNewsBtn.textContent = "Lösche...";
      try {
        await fetch(infoDbHost + "/news.json?auth=" + user.idToken, { method: "DELETE" });
        aktuelleNewsDaten = { ...STANDARD_NEWS };
        hatEigeneNews = false;
        zeichneNewsBanner();
        backdrop.remove();
      } catch (e) {
        msg.textContent = "Fehler beim Löschen: " + e.message;
      }
    };
    sheet.appendChild(delNewsBtn);
  }

  sheet.appendChild(msg);
  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);
}
function zeichneSponsorenBanner() {
const container = document.getElementById("sponsor-slot");
const user = getAktuellerUser();
if (!container || !user) return;
if (sponsorLoopTimer) {
clearTimeout(sponsorLoopTimer);
sponsorLoopTimer = null;
}
container.innerHTML = "";
const basisListe = sponsorenListe.length > 0 ? sponsorenListe : [
{ firma: "TSV Partner", slogan: "Hier kann Ihre Bandenwerbung stehen!", bild: "" }
];
// Für nahtlosen Loop: Erstes Element am Ende noch einmal anhängen, falls > 1 Sponsor
const loopListe = basisListe.length > 1 ? [...basisListe, basisListe.slice(0, 1).pop()] : basisListe;
const banner = document.createElement("div");
banner.className = "sponsor-banner";
if (basisListe.some(x => x.bild)) banner.classList.add("has-image");
const track = document.createElement("div");
track.className = "sponsor-slider-track";
loopListe.forEach(sp => {
const slide = document.createElement("div");
slide.className = "sponsor-slide" + (sp.bild ? " has-image" : "");
if (sp.bild) {
const img = document.createElement("img");
img.className = "sponsor-banner-img";
img.src = sp.bild;
img.alt = sp.firma || "Sponsor";
slide.appendChild(img);
} else {
slide.style.padding = "14px 16px";
const logoDiv = document.createElement("div");
logoDiv.className = "sponsor-logo";
logoDiv.textContent = sp.firma || "TSV Partner";
const sloganDiv = document.createElement("div");
sloganDiv.className = "sponsor-slogan";
sloganDiv.textContent = sp.slogan || "Stark im Team – auf und neben dem Platz.";
slide.append(logoDiv, sloganDiv);
}
track.appendChild(slide);
});
banner.appendChild(track);
// Indikator-Punkte unten
const dotsWrap = document.createElement("div");
dotsWrap.className = "sponsor-dots";
const dotEls = [];
if (basisListe.length > 1) {
basisListe.forEach((_, idx) => {
const dot = document.createElement("span");
dot.className = "sponsor-dot" + (idx === 0 ? " active" : "");
dotsWrap.appendChild(dot);
dotEls.push(dot);
});
banner.appendChild(dotsWrap);
}
if (user.role === "Vorstand") {
const manageBtn = document.createElement("button");
manageBtn.type = "button";
manageBtn.className = "sponsor-gear-btn";
manageBtn.textContent = "⚙️";
manageBtn.onclick = (e) => {
e.stopPropagation();
oeffneSponsorenManager();
};
banner.appendChild(manageBtn);
}
container.appendChild(banner);
// Nahtlose Endlosschleife starten, sobald mindestens 2 Werbepartner vorhanden sind
if (basisListe.length > 1) {
let pos = 0;
const slideDauerMs = 800; // 0,8 Sekunden sanftes Gleiten
const pauseDauerMs = 1000; // Exakt 1 Sekunde Pause voll im Bild
function aktualisierePunkte(index) {
const echterIndex = index % basisListe.length;
dotEls.forEach((d, i) => {
if (i === echterIndex) d.classList.add("active");
else d.classList.remove("active");
});
}
function naechsterSchritt() {
if (!document.getElementById("sponsor-slot")) return;
pos++;
track.style.transition = "transform " + slideDauerMs + "ms cubic-bezier(0.25, 0.8, 0.25, 1)";
track.style.transform = "translateX(-" + (pos * 100) + "%)";
aktualisierePunkte(pos);
// Wenn wir auf der Kopie des ersten Banners angekommen sind: Nach dem Gleiten unsichtbar auf 0 zurücksetzen
if (pos === basisListe.length) {
setTimeout(() => {
track.style.transition = "none";
pos = 0;
track.style.transform = "translateX(0%)";
}, slideDauerMs);
}
// Nach Gleitzeit + exakt 1 Sekunde Pause voll im Bild den nächsten Slide starten
sponsorLoopTimer = setTimeout(naechsterSchritt, slideDauerMs + pauseDauerMs);
}
// Erste Pause von 1 Sekunde voll im Bild, dann startet die Endlosschleife
sponsorLoopTimer = setTimeout(naechsterSchritt, pauseDauerMs);
}
}
function oeffneSponsorenManager() {
const user = getAktuellerUser();
if (!user || user.role !== "Vorstand") return;
let neuesBannerBase64 = "";
const backdrop = document.createElement("div");
backdrop.className = "modal-backdrop";
const sheet = document.createElement("div");
sheet.className = "bottom-sheet";
const head = document.createElement("div");
head.className = "sheet-header";
const h3 = document.createElement("h3");
h3.style.cssText = "margin:0;font-size:18px;color:var(--navy);";
h3.textContent = "Bandenwerbung (Bilder)";
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
p.textContent = "Noch keine Werbebanner hochgeladen.";
listDiv.appendChild(p);
return;
}
sponsorenListe.forEach(sp => {
const row = document.createElement("div");
row.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px;background:#f8fafc;border-radius:12px;margin-bottom:8px;border:1px solid var(--border);";
const leftPart = document.createElement("div");
leftPart.style.cssText = "display:flex;align-items:center;gap:10px;min-width:0;flex:1;";
if (sp.bild) {
const miniImg = document.createElement("img");
miniImg.src = sp.bild;
miniImg.style.cssText = "width:70px;height:36px;object-fit:cover;border-radius:6px;flex-shrink:0;";
leftPart.appendChild(miniImg);
}
const stName = document.createElement("strong");
stName.style.cssText = "font-size:13px;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
stName.textContent = sp.firma || "Werbepartner";
leftPart.appendChild(stName);
const del = document.createElement("button");
del.type = "button";
del.className = "btn-danger";
del.textContent = "Löschen";
del.style.cssText = "width:auto;padding:6px 10px;margin:0;font-size:11px;flex-shrink:0;";
del.onclick = async () => {
await fetch(infoDbHost + "/sponsoren/" + sp.id + ".json?auth=" + user.idToken, { method: "DELETE" });
sponsorenListe = sponsorenListe.filter(x => x.id !== sp.id);
renderPartnerListe();
zeichneSponsorenBanner();
};
row.append(leftPart, del);
listDiv.appendChild(row);
});
}
renderPartnerListe();
sheet.appendChild(listDiv);
const subTitle = document.createElement("h4");
subTitle.style.cssText = "margin:0 0 10px;font-size:14px;color:var(--navy);";
subTitle.textContent = "+ Neues Werbebanner hochladen";
const firmaIn = erstelleFeld("text", "sp-firma", "Name des Sponsors (z. B. Autohaus Weber)");
const previewImg = document.createElement("img");
previewImg.className = "img-preview-box hidden";
const fileInput = document.createElement("in" + "put");
fileInput.setAttribute("type", "file");
fileInput.setAttribute("accept", "image/*");
fileInput.onchange = async (e) => {
const file = e.target.files.item(0);
if (!file) return;
neuesBannerBase64 = await komprimiereBildDatei(file, 700, 0.8);
previewImg.src = neuesBannerBase64;
previewImg.classList.remove("hidden");
};
const addBtn = document.createElement("button");
addBtn.type = "button";
addBtn.className = "btn-success";
addBtn.textContent = "Banner speichern";
addBtn.onclick = async () => {
if (!neuesBannerBase64) {
alert("Bitte zuerst ein Werbebild auswählen!");
return;
}
addBtn.textContent = "Lade Banner hoch...";
const neuerPartner = {
firma: firmaIn.value.trim() || "TSV Partner",
bild: neuesBannerBase64
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
fileInput.value = "";
neuesBannerBase64 = "";
previewImg.classList.add("hidden");
renderPartnerListe();
zeichneSponsorenBanner();
}
addBtn.textContent = "Banner speichern";
};
backdrop.onclick = (e) => { if (e.target === backdrop) backdrop.remove(); };
sheet.append(
subTitle,
erstelleLabel("Sponsor-Name (für die Übersicht)"), firmaIn,
erstelleLabel("Banner-Bild auswählen (Querformat empfohlen)"), fileInput, previewImg,
addBtn
);
backdrop.appendChild(sheet);
document.body.appendChild(backdrop);
}
