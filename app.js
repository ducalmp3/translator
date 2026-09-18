// VideoTraduci — videochiamata 1-a-1 con sottotitoli tradotti in tempo reale.
// Stack: WebRTC (via PeerJS, con il server di segnalazione pubblico gratuito),
// Web Speech API del browser per la trascrizione vocale, MyMemory per la traduzione.
//
// I testi dell'interfaccia (pulsanti, etichette, messaggi) sono tradotti tramite
// il dizionario in i18n.js (funzione t()); i nomi delle lingue nei menu a tendina
// sono generati automaticamente con Intl.DisplayNames, così restano sempre coerenti
// con la lingua dell'interfaccia scelta, senza doverli tradurre a mano.

// Se le chiamate cadono per via di reti restrittive (doppio NAT, CGNAT, reti mobili,
// molte reti domestiche/aziendali), il motivo è quasi sempre l'assenza di un server
// TURN: senza TURN il collegamento video funziona solo quando i due dispositivi
// riescono a connettersi direttamente, cosa che su molte reti reali non succede.
// Per risolvere in modo stabile: registrati gratis su https://dashboard.metered.ca/signup,
// nel pannello genera una credenziale, clicca "Instructions" e incolla qui sotto
// l'array "iceServers" che ti mostra (contiene sia STUN che TURN con le tue
// credenziali). Finché non lo fai, resta solo lo STUN pubblico di Google, che basta
// per molte reti ma non per quelle più restrittive.
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.relay.metered.ca:80" },
  {
    urls: "turn:standard.relay.metered.ca:80",
    username: "cf8610ff632d3bfa520ab9a2",
    credential: "WC/syrP14OaQYw6W",
  },
  {
    urls: "turn:standard.relay.metered.ca:80?transport=tcp",
    username: "cf8610ff632d3bfa520ab9a2",
    credential: "WC/syrP14OaQYw6W",
  },
  {
    urls: "turn:standard.relay.metered.ca:443",
    username: "cf8610ff632d3bfa520ab9a2",
    credential: "WC/syrP14OaQYw6W",
  },
  {
    urls: "turns:standard.relay.metered.ca:443?transport=tcp",
    username: "cf8610ff632d3bfa520ab9a2",
    credential: "WC/syrP14OaQYw6W",
  },
];

const LANGUAGES = [
  { code: "it", speech: "it-IT" },
  { code: "en", speech: "en-US" },
  { code: "es", speech: "es-ES" },
  { code: "fr", speech: "fr-FR" },
  { code: "de", speech: "de-DE" },
  { code: "pt-PT", speech: "pt-PT" },
  { code: "pt-BR", speech: "pt-BR" },
  { code: "nl", speech: "nl-NL" },
  { code: "pl", speech: "pl-PL" },
  { code: "ru", speech: "ru-RU" },
  { code: "zh", speech: "zh-CN" },
  { code: "ja", speech: "ja-JP" },
  { code: "ar", speech: "ar-SA" },
  { code: "tr", speech: "tr-TR" },
  { code: "hi", speech: "hi-IN" },
];

const el = (id) => document.getElementById(id);

const setupScreen = el("setup-screen");
const callScreen = el("call-screen");
const uiLangSel = el("uiLang");
const spokenLangSel = el("spokenLang");
const captionLangSel = el("captionLang");
const createBtn = el("createBtn");
const joinBtn = el("joinBtn");
const joinCodeInput = el("joinCodeInput");
const myCodeBox = el("myCodeBox");
const myCodeEl = el("myCode");
const copyCodeBtn = el("copyCodeBtn");
const setupStatus = el("setupStatus");
const localVideo = el("localVideo");
const remoteVideo = el("remoteVideo");
const muteBtn = el("muteBtn");
const hangupBtn = el("hangupBtn");
const localLiveCaption = el("localLiveCaption");
const remoteLiveCaption = el("remoteLiveCaption");
const transcriptLog = el("transcriptLog");

let peer = null;
let mediaConn = null;
let dataConn = null;
let localStream = null;
let recognition = null;
let callActive = false;
let micMuted = false;
let recognitionErrorStreak = 0;
let recognitionRestartTimer = null;

window.currentUiLang = "it";

function getLang(code) {
  return LANGUAGES.find((l) => l.code === code);
}

// Nome della lingua "code", scritto nella lingua "inUiLang" (es. getLangDisplayName("pt-BR", "it") -> "Portoghese (Brasile)").
function getLangDisplayName(code, inUiLang) {
  try {
    const dn = new Intl.DisplayNames([inUiLang], { type: "language" });
    const name = dn.of(code);
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch (e) {
    return code;
  }
}

function detectDefaultUiLang() {
  let saved = null;
  try { saved = localStorage.getItem("videotraduci_uiLang"); } catch (e) {}
  if (saved && SUPPORTED_UI_LANGS.includes(saved)) return saved;

  const browserLangs = navigator.languages || [navigator.language || "en"];
  for (const bl of browserLangs) {
    const primary = bl.split("-")[0].toLowerCase();
    if (SUPPORTED_UI_LANGS.includes(primary)) return primary;
  }
  return "en";
}

function defaultLangCodeForUi(uiKey) {
  const exact = LANGUAGES.find((l) => l.code === uiKey);
  if (exact) return exact.code;
  const prefixMatch = LANGUAGES.find((l) => l.code.startsWith(uiKey + "-"));
  if (prefixMatch) return prefixMatch.code;
  return "en";
}

// Prova a indovinare la lingua parlata/sottotitoli più probabile: prima cerca una
// corrispondenza esatta con la lingua del browser (es. "pt-BR" -> Portoghese Brasile),
// altrimenti ricade sulla lingua dell'interfaccia scelta.
function detectDefaultLangCode(uiKey) {
  const browserLangs = navigator.languages || [navigator.language || ""];
  for (const bl of browserLangs) {
    const match = LANGUAGES.find((l) => l.code.toLowerCase() === bl.toLowerCase());
    if (match) return match.code;
  }
  return defaultLangCodeForUi(uiKey);
}

function populateUiLangSelect() {
  uiLangSel.innerHTML = "";
  for (const code of SUPPORTED_UI_LANGS) {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = getLangDisplayName(code, code); // autonimo: ogni lingua scritta in se stessa
    uiLangSel.appendChild(opt);
  }
  uiLangSel.value = window.currentUiLang;
}

function populateLanguageSelects() {
  const prevSpoken = spokenLangSel.value;
  const prevCaption = captionLangSel.value;

  for (const sel of [spokenLangSel, captionLangSel]) {
    sel.innerHTML = "";
    for (const lang of LANGUAGES) {
      const opt = document.createElement("option");
      opt.value = lang.code;
      opt.textContent = getLangDisplayName(lang.code, window.currentUiLang);
      sel.appendChild(opt);
    }
  }

  const fallback = detectDefaultLangCode(window.currentUiLang);
  spokenLangSel.value = LANGUAGES.some((l) => l.code === prevSpoken) ? prevSpoken : fallback;
  captionLangSel.value = LANGUAGES.some((l) => l.code === prevCaption) ? prevCaption : fallback;
}

function applyTranslations() {
  document.documentElement.lang = window.currentUiLang;
  document.documentElement.dir = RTL_UI_LANGS.includes(window.currentUiLang) ? "rtl" : "ltr";

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.getAttribute("data-i18n-placeholder"));
  });

  muteBtn.textContent = micMuted ? t("unmuteBtnLabel") : t("muteBtnLabel");
  copyCodeBtn.textContent = t("copyBtnLabel");
  uiLangSel.setAttribute("aria-label", t("uiLangLabel"));

  populateUiLangSelect();
  populateLanguageSelects();
}

function setUiLang(code) {
  window.currentUiLang = SUPPORTED_UI_LANGS.includes(code) ? code : "en";
  try { localStorage.setItem("videotraduci_uiLang", window.currentUiLang); } catch (e) {}
  applyTranslations();
}

function setStatus(msg, isError = false) {
  setupStatus.textContent = msg;
  setupStatus.style.color = isError ? "#ff5c5c" : "#2fd08b";
}

function randomCode(len = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function ensureLocalMedia() {
  if (localStream) return localStream;
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
  return localStream;
}

function showCallScreen() {
  setupScreen.classList.add("hidden");
  callScreen.classList.remove("hidden");
}

function showSetupScreen() {
  callScreen.classList.add("hidden");
  setupScreen.classList.remove("hidden");
  myCodeBox.classList.add("hidden");
  myCodeEl.textContent = "—";
  createBtn.disabled = false;
  joinBtn.disabled = false;
  setStatus("");
}

function wireDataConnection(conn) {
  dataConn = conn;
  dataConn.on("data", (data) => {
    if (data && data.type === "speech") {
      handleIncomingSpeech(data.text, data.lang);
    }
  });
  dataConn.on("close", () => {
    appendTranscript("system", t("systemDisconnected"), null, false);
  });
}

function attachRemoteStream(stream) {
  remoteVideo.srcObject = stream;
  showCallScreen();
  callActive = true;
  startRecognition();
}

function startCallAsHost() {
  createBtn.disabled = true;
  joinBtn.disabled = true;
  setStatus(t("statusActivatingMedia"));

  ensureLocalMedia()
    .then(() => {
      const code = randomCode();
      peer = new Peer(code, { config: { iceServers: ICE_SERVERS } });

      peer.on("open", (id) => {
        myCodeEl.textContent = id;
        myCodeBox.classList.remove("hidden");
        setStatus(t("statusCodeGenerated"));
      });

      peer.on("call", (call) => {
        call.answer(localStream);
        mediaConn = call;
        call.on("stream", attachRemoteStream);
        call.on("close", () => endCall(true));
      });

      peer.on("connection", (conn) => {
        wireDataConnection(conn);
      });

      // Il socket verso il server di segnalazione può cadere per un attimo (rete
      // instabile, wifi che cambia canale, ecc.) senza che la chiamata P2P sia
      // davvero da chiudere: ritentiamo la riconnessione prima di arrenderci.
      peer.on("disconnected", () => {
        if (callActive) {
          try { peer.reconnect(); } catch (e) {}
        }
      });

      peer.on("error", (err) => {
        console.error(err);
        if (callActive) {
          endCall(true);
        } else {
          setStatus(t("statusConnError") + err.type, true);
          createBtn.disabled = false;
          joinBtn.disabled = false;
        }
      });
    })
    .catch((err) => {
      console.error(err);
      setStatus(t("statusMediaError") + err.message, true);
      createBtn.disabled = false;
      joinBtn.disabled = false;
    });
}

function joinCall() {
  const remoteCode = joinCodeInput.value.trim().toLowerCase();
  if (!remoteCode) {
    setStatus(t("statusEnterCode"), true);
    return;
  }

  createBtn.disabled = true;
  joinBtn.disabled = true;
  setStatus(t("statusActivatingMedia"));

  ensureLocalMedia()
    .then(() => {
      peer = new Peer(undefined, { config: { iceServers: ICE_SERVERS } });

      peer.on("open", () => {
        setStatus(t("statusConnecting"));
        mediaConn = peer.call(remoteCode, localStream);
        mediaConn.on("stream", attachRemoteStream);
        mediaConn.on("close", () => endCall(true));

        const conn = peer.connect(remoteCode);
        wireDataConnection(conn);
      });

      peer.on("disconnected", () => {
        if (callActive) {
          try { peer.reconnect(); } catch (e) {}
        }
      });

      peer.on("error", (err) => {
        console.error(err);
        if (callActive) {
          endCall(true);
        } else {
          setStatus(t("statusConnError") + err.type + t("statusConnErrorCheckCode"), true);
          createBtn.disabled = false;
          joinBtn.disabled = false;
        }
      });
    })
    .catch((err) => {
      console.error(err);
      setStatus(t("statusMediaError") + err.message, true);
      createBtn.disabled = false;
      joinBtn.disabled = false;
    });
}

function endCall(droppedUnexpectedly) {
  callActive = false;
  if (recognitionRestartTimer) {
    clearTimeout(recognitionRestartTimer);
    recognitionRestartTimer = null;
  }
  if (recognition) {
    try { recognition.onend = null; recognition.stop(); } catch (e) {}
    recognition = null;
  }
  if (mediaConn) { try { mediaConn.close(); } catch (e) {} mediaConn = null; }
  if (dataConn) { try { dataConn.close(); } catch (e) {} dataConn = null; }
  if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }
  remoteVideo.srcObject = null;
  localVideo.srcObject = null;
  transcriptLog.innerHTML = "";
  localLiveCaption.textContent = "…";
  remoteLiveCaption.textContent = "…";
  showSetupScreen();
  if (droppedUnexpectedly === true) {
    setStatus(t("callDropped"), true);
  }
}

function toggleMute() {
  if (!localStream) return;
  micMuted = !micMuted;
  localStream.getAudioTracks().forEach((tr) => (tr.enabled = !micMuted));
  muteBtn.textContent = micMuted ? t("unmuteBtnLabel") : t("muteBtnLabel");
}

function appendTranscript(who, originalText, translatedText, isRemote) {
  const line = document.createElement("div");
  line.className = "transcript-line" + (isRemote ? " remote" : "");
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const whoLabel = who === "system" ? "" : `<span class="who">${who}:</span>`;
  const text = translatedText ? `${originalText} → ${translatedText}` : originalText;
  line.innerHTML = `${whoLabel}${text}<span class="time">${time}</span>`;
  transcriptLog.appendChild(line);
  transcriptLog.scrollTop = transcriptLog.scrollHeight;
}

async function translateText(text, sourceLang, targetLang) {
  if (sourceLang === targetLang) return text;
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
    const res = await fetch(url);
    const json = await res.json();
    const translated = json && json.responseData && json.responseData.translatedText;
    return translated || null;
  } catch (err) {
    console.error("Translation failed", err);
    return null;
  }
}

async function handleIncomingSpeech(text, senderLangCode) {
  const myCaptionLang = captionLangSel.value;
  remoteLiveCaption.textContent = text;
  const translated = await translateText(text, senderLangCode, myCaptionLang);
  remoteLiveCaption.textContent = translated || text;
  appendTranscript(t("remoteLabel"), text, translated || t("noTranslationAvailable"), true);
}

// Errori del riconoscimento vocale dopo i quali non ha senso ritentare (l'utente
// deve prima sistemare qualcosa): mostriamo un messaggio chiaro invece di ritentare
// all'infinito, cosa che su alcune reti aziendali può mandare in crash la scheda
// del browser (loop stretto di richieste che falliscono subito una dopo l'altra).
const FATAL_SPEECH_ERRORS = ["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported"];
const MAX_SPEECH_ERROR_STREAK = 6;

function startRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    localLiveCaption.textContent = t("unsupportedSpeech");
    return;
  }

  const mySpokenCode = spokenLangSel.value;
  const mySpokenLang = getLang(mySpokenCode);

  recognitionErrorStreak = 0;
  recognition = new SR();
  recognition.lang = mySpokenLang.speech;
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    recognitionErrorStreak = 0; // il riconoscimento funziona: azzera il contatore errori
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const chunk = result[0].transcript;
      if (result.isFinal) {
        localLiveCaption.textContent = chunk;
        appendTranscript(t("youLabel"), chunk, null, false);
        if (dataConn && dataConn.open) {
          dataConn.send({ type: "speech", text: chunk, lang: mySpokenCode });
        }
      } else {
        interim += chunk;
      }
    }
    if (interim) localLiveCaption.textContent = interim;
  };

  let specificMessageShown = false;

  recognition.onerror = (event) => {
    console.warn("Speech recognition error:", event.error);
    recognitionErrorStreak++;

    if (event.error === "network") {
      localLiveCaption.textContent = t("speechNetworkError");
      specificMessageShown = true;
    } else if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      localLiveCaption.textContent = t("speechPermissionError");
      specificMessageShown = true;
    }

    if (FATAL_SPEECH_ERRORS.includes(event.error)) {
      recognitionErrorStreak = MAX_SPEECH_ERROR_STREAK; // non ritentare, serve un intervento manuale
    }
  };

  recognition.onend = () => {
    if (!callActive) return;

    if (recognitionErrorStreak >= MAX_SPEECH_ERROR_STREAK) {
      if (!specificMessageShown) localLiveCaption.textContent = t("speechGaveUp");
      return; // fermiamo i tentativi automatici: niente più loop
    }

    // backoff crescente man mano che gli errori si ripetono, per non martellare
    // il servizio (e il browser) più volte al secondo
    const delay = recognitionErrorStreak > 0 ? Math.min(1000 * recognitionErrorStreak, 5000) : 250;
    recognitionRestartTimer = setTimeout(() => {
      if (callActive) {
        try { recognition.start(); } catch (e) {}
      }
    }, delay);
  };

  try { recognition.start(); } catch (e) { console.error(e); }
}

createBtn.addEventListener("click", startCallAsHost);
joinBtn.addEventListener("click", joinCall);
muteBtn.addEventListener("click", toggleMute);
hangupBtn.addEventListener("click", () => endCall(false));
uiLangSel.addEventListener("change", () => setUiLang(uiLangSel.value));
copyCodeBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(myCodeEl.textContent).then(() => {
    copyCodeBtn.textContent = t("copiedLabel");
    setTimeout(() => (copyCodeBtn.textContent = t("copyBtnLabel")), 1500);
  });
});

window.currentUiLang = detectDefaultUiLang();
applyTranslations();
