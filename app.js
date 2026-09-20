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

// Blocco d'accesso: una passphrase semplice condivisa con chi deve usare l'app,
// pensata per tenere fuori visitatori casuali (link indicizzato, repository
// pubblico trovato per caso) — NON è vera sicurezza: chi apre gli strumenti
// sviluppatore del browser può comunque leggere questo file, hash incluso.
// Per cambiare la passphrase, genera il nuovo hash SHA-256 (es. in una console
// con: crypto.subtle.digest("SHA-256", new TextEncoder().encode("nuova-passphrase"))
// oppure con un tool online) e sostituisci il valore qui sotto.
const PASSPHRASE_HASH_HEX = "1d7b8fa16db105df2b7eceed8eec88a976dfac86e55ca04801874d48206935fb";

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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

const lockScreen = el("lock-screen");
const lockPassInput = el("lockPassInput");
const lockBtn = el("lockBtn");
const lockStatus = el("lockStatus");
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

function isUnlocked() {
  try { return localStorage.getItem("videotraduci_unlocked") === "1"; } catch (e) { return false; }
}

function unlockAndShowSetup() {
  try { localStorage.setItem("videotraduci_unlocked", "1"); } catch (e) {}
  lockScreen.classList.add("hidden");
  showSetupScreen();
}

async function attemptUnlock() {
  const attempt = lockPassInput.value;
  if (!attempt) return;
  lockBtn.disabled = true;
  try {
    const hash = await sha256Hex(attempt);
    if (hash === PASSPHRASE_HASH_HEX) {
      lockStatus.textContent = "";
      unlockAndShowSetup();
    } else {
      lockStatus.textContent = t("lockError");
      lockStatus.style.color = "#ff5c5c";
      lockPassInput.value = "";
      lockPassInput.focus();
    }
  } catch (e) {
    lockStatus.textContent = t("lockError");
    lockStatus.style.color = "#ff5c5c";
  } finally {
    lockBtn.disabled = false;
  }
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

// --- Traduzione ---------------------------------------------------------
// Due strade, provate in quest'ordine:
//  1. Il traduttore integrato nel browser (Translator API, Chrome 138+ e Edge
//     148+, solo desktop): gira in locale sul dispositivo, è gratuito, non ha
//     limiti giornalieri e non manda il testo a nessun server esterno. La prima
//     volta che serve una coppia di lingue il browser scarica il modello da solo.
//  2. MyMemory, come riserva per i dispositivi senza traduttore integrato
//     (attualmente tutti i cellulari). È gratuito ma ha un limite giornaliero
//     per indirizzo IP: circa 5.000 caratteri in forma anonima, che salgono a
//     circa 50.000 indicando un'email nella richiesta (nessuna registrazione,
//     basta scriverla qui sotto).
const MYMEMORY_EMAIL = "";

const builtInTranslators = new Map(); // "sorgente|destinazione" -> Promise<Translator|null>
let myMemoryQuotaExhausted = false;
let quotaNoticeShown = false;

// Il traduttore integrato ragiona per lingua, non per variante regionale: se
// "pt-BR" non è supportato come tale, riproviamo con "pt".
function langVariants(code) {
  const base = code.split("-")[0];
  return base === code ? [code] : [code, base];
}

async function getBuiltInTranslator(sourceLang, targetLang) {
  if (!("Translator" in self)) return null;

  const key = `${sourceLang}|${targetLang}`;
  if (builtInTranslators.has(key)) return builtInTranslators.get(key);

  const pending = (async () => {
    for (const src of langVariants(sourceLang)) {
      for (const tgt of langVariants(targetLang)) {
        try {
          const opts = { sourceLanguage: src, targetLanguage: tgt };
          const status = await Translator.availability(opts);
          if (status === "unavailable") continue;
          return await Translator.create(opts);
        } catch (err) {
          console.warn("Traduttore integrato non utilizzabile per", src, "->", tgt, err);
        }
      }
    }
    return null;
  })();

  builtInTranslators.set(key, pending);
  return pending;
}

async function translateWithMyMemory(text, sourceLang, targetLang) {
  if (myMemoryQuotaExhausted) return null;
  try {
    let url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}` +
      `&langpair=${encodeURIComponent(sourceLang)}|${encodeURIComponent(targetLang)}`;
    if (MYMEMORY_EMAIL) url += `&de=${encodeURIComponent(MYMEMORY_EMAIL)}`;

    const res = await fetch(url);
    const json = await res.json();
    const translated = (json && json.responseData && json.responseData.translatedText) || "";

    // Quota esaurita: MyMemory risponde 200 mettendo il testo dell'avviso al
    // posto della traduzione, quindi va riconosciuto e trattato come errore,
    // altrimenti l'avviso finirebbe nei sottotitoli come se fosse il tradotto.
    const quotaHit =
      json.responseStatus === 403 ||
      /^MYMEMORY WARNING/i.test(translated) ||
      /ALL AVAILABLE FREE TRANSLATIONS/i.test(translated);

    if (quotaHit) {
      myMemoryQuotaExhausted = true;
      console.warn("MyMemory: quota giornaliera esaurita", json.responseDetails || translated);
      return null;
    }

    return translated || null;
  } catch (err) {
    console.error("Traduzione MyMemory fallita", err);
    return null;
  }
}

async function translateText(text, sourceLang, targetLang) {
  if (sourceLang === targetLang) return text;

  const translator = await getBuiltInTranslator(sourceLang, targetLang);
  if (translator) {
    try {
      const out = await translator.translate(text);
      if (out) return out;
    } catch (err) {
      console.warn("Traduttore integrato fallito, passo a MyMemory", err);
    }
  }

  return translateWithMyMemory(text, sourceLang, targetLang);
}

async function handleIncomingSpeech(text, senderLangCode) {
  const myCaptionLang = captionLangSel.value;
  remoteLiveCaption.textContent = text;
  const translated = await translateText(text, senderLangCode, myCaptionLang);
  remoteLiveCaption.textContent = translated || text;

  if (!translated && myMemoryQuotaExhausted && !quotaNoticeShown) {
    quotaNoticeShown = true;
    appendTranscript("system", t("translationQuotaExceeded"), null, false);
  }

  appendTranscript(t("remoteLabel"), text, translated || t("noTranslationAvailable"), true);
}

// Errori del riconoscimento vocale dopo i quali non ha senso ritentare (l'utente
// deve prima sistemare qualcosa): mostriamo un messaggio chiaro invece di ritentare
// all'infinito, cosa che su alcune reti aziendali può mandare in crash la scheda
// del browser (loop stretto di richieste che falliscono subito una dopo l'altra).
const FATAL_SPEECH_ERRORS = ["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported"];
// "no-speech" (nessun parlato rilevato per qualche secondo) e "aborted" (interruzione
// interna, es. quando il codice stesso riavvia il riconoscimento) sono del tutto
// normali durante una conversazione reale: capitano ogni volta che è il turno di
// parlare dell'altra persona, o semplicemente durante una pausa. Non li contiamo
// come errori veri, altrimenti bastano poche pause per esaurire i tentativi e
// fermare tutto per errore.
const BENIGN_SPEECH_ERRORS = ["no-speech", "aborted"];
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
    if (!BENIGN_SPEECH_ERRORS.includes(event.error)) {
      recognitionErrorStreak++;
    }

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
lockBtn.addEventListener("click", attemptUnlock);
lockPassInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") attemptUnlock();
});

window.currentUiLang = detectDefaultUiLang();
applyTranslations();

if (isUnlocked()) {
  lockScreen.classList.add("hidden");
  setupScreen.classList.remove("hidden");
} else {
  lockPassInput.focus();
}
