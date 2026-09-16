# VideoTraduci

Prototipo di videochiamata 1-a-1 con sottotitoli tradotti in tempo reale, costruito con
tecnologie gratuite:

- **Video/audio**: WebRTC tramite [PeerJS](https://peerjs.com/), che usa un server di
  segnalazione pubblico gratuito e i server STUN di Google per il collegamento diretto
  tra i due browser (non c'è un vero server "in mezzo" per il flusso video/audio).
- **Trascrizione vocale**: Web Speech API del browser (funziona bene solo su **Chrome** o
  **Edge**; Firefox e Safari non la supportano o la supportano male).
- **Traduzione**: [MyMemory](https://mymemory.translated.net/), API di traduzione
  gratuita senza bisogno di registrazione o chiave API.

Nessun account, nessuna chiave API da configurare, nessun server da installare per usarlo.

## Lingua dell'interfaccia

In alto a destra c'è un selettore 🌐 che cambia la lingua di tutti i testi dell'app (pulsanti,
etichette, messaggi) — attualmente disponibile in italiano, inglese, portoghese (Portogallo e
Brasile), spagnolo, francese, tedesco, olandese, polacco, russo, cinese, giapponese, arabo,
turco e hindi. Viene rilevata automaticamente dalla lingua del browser al primo accesso e
poi ricordata (nel browser, non condivisa con l'altra persona).

Questa è **indipendente** dalle due lingue scelte più sotto ("lingua che parli" e "lingua dei
sottotitoli"): un utilizzatore brasiliano può impostare l'interfaccia in portoghese, scegliere
"Portoghese (Brasile)" come lingua che parla e "Italiano" (o qualunque altra lingua) come
lingua dei sottotitoli — e viceversa per la persona dall'altra parte della chiamata. Ognuno
imposta le proprie tre scelte in autonomia sul proprio browser.

## Come si usa

1. Apri il progetto con un piccolo server locale (necessario perché i browser bloccano
   l'accesso a microfono/videocamera se apri il file direttamente con doppio click).
   Nella cartella del progetto esegui uno di questi comandi (serve Node.js oppure Python,
   uno dei due è quasi sempre già installato):

   ```bash
   npx serve .
   # oppure
   python3 -m http.server 8080
   ```

2. Apri l'indirizzo che ti viene mostrato (es. `http://localhost:3000` o
   `http://localhost:8080`) in **Chrome o Edge**.

3. Scegli la lingua che parli e la lingua in cui vuoi leggere i sottotitoli, poi:
   - clicca **"Crea chiamata"**: ti verrà mostrato un codice (es. `k3f9a2`);
   - manda quel codice all'altra persona (WhatsApp, email, ecc.).

4. L'altra persona apre lo stesso sito (ognuno lo esegue dal proprio computer — non serve
   che sia lo stesso server), sceglie le proprie lingue, incolla il codice nel campo
   **"Unisciti a una chiamata"** e clicca **"Connetti"**.

5. Concedete entrambi il permesso per microfono e videocamera quando il browser lo chiede.
   Parte la videochiamata e sotto compaiono i sottotitoli: i tuoi in tempo reale mentre parli,
   quelli dell'altra persona tradotti automaticamente nella lingua che hai scelto.

Non serve che i due computer siano sulla stessa rete: il codice viene scambiato tramite il
server di segnalazione pubblico di PeerJS via internet, quindi funziona anche con persone
in città o paesi diversi.

## Limiti da tenere presente (è un prototipo gratuito, non un prodotto professionale)

- **Nessun server TURN**: la connessione video è diretta tra i due browser. Nella grande
  maggioranza delle reti domestiche/ufficio funziona senza problemi, ma reti molto
  restrittive (VPN aziendali rigide, alcuni firewall) potrebbero impedire la connessione
  diretta e far fallire la chiamata.
- **Riconoscimento vocale solo su Chrome/Edge**: su altri browser i sottotitoli non
  funzioneranno. Inoltre Chrome invia l'audio ai server di Google per trascriverlo (non è
  un'elaborazione 100% locale) — da tenere presente per conversazioni sensibili.
- **Traduzione con quota gratuita limitata**: MyMemory è gratuito ma ha un tetto giornaliero
  di richieste per indirizzo IP anonimo. Per un uso normale (poche chiamate al giorno) non
  dovresti accorgertene; con un uso molto intenso potresti ricevere traduzioni mancanti.
- **Un solo ambiente per volta**: pensato per 2 persone, non per chiamate di gruppo.
- **Il codice di chiamata non è privato**: chiunque conosca il codice generato potrebbe, in
  teoria, provare a connettersi. Va condiviso solo con la persona giusta e usato per chiamate
  singole (ogni "Crea chiamata" genera un codice nuovo).

## Risoluzione problemi

- **"Non trascrive né traduce niente" / la chiamata cade a un certo punto.** La causa più
  probabile, soprattutto testando da un **laptop aziendale**, è che la rete blocchi l'accesso
  ai server di Google usati da Chrome/Edge per il riconoscimento vocale (VPN aziendali e
  firewall restrittivi spesso lo fanno). Quando questo succede, l'app ora mostra un messaggio
  esplicito sotto "Tu stai dicendo" (es. *"Il riconoscimento vocale non riesce a raggiungere i
  server di Google..."*) invece di restare in silenzio, e non ritenta all'infinito (i tentativi
  ravvicinati potevano in passato appesantire il browser fino a farlo sembrare "chiuso").
  Per verificare che sia questo il problema, prova la stessa chiamata da una rete diversa
  (es. l'hotspot del telefono) invece che dalla rete aziendale.
- **La chiamata si interrompe da sola.** Con la stessa causa di rete instabile, anche il
  collegamento video può cadere: l'app ora prova a riconnettersi automaticamente per le
  interruzioni brevi e, se non ci riesce, torna alla schermata iniziale mostrando *"La
  chiamata si è interrotta inaspettatamente..."* invece di chiudersi senza spiegazioni.
- **I sottotitoli non compaiono su uno smartphone.** Su Android, Chrome funziona bene. Su
  iPhone/iPad, invece, il riconoscimento vocale del browser (sia su Safari che su Chrome, che
  su iOS usa comunque il motore di Safari sotto il cofano) è noto per essere poco affidabile —
  si interrompe dopo pochi secondi o non parte affatto. Al momento i sottotitoli in invio
  funzionano in modo affidabile solo da Chrome/Edge desktop e da Chrome su Android; su iOS
  l'app resta comunque utilizzabile per la sola videochiamata.

## Possibili miglioramenti futuri

- Passare a un motore di traduzione/trascrizione cloud (Google/Azure/DeepL) per qualità e
  copertura linguistica migliori (a scapito della gratuità oltre una certa soglia).
- Aggiungere un server TURN (es. tramite un provider come Twilio o Metered) per rendere le
  connessioni affidabili anche su reti restrittive.
- Salvare/esportare la trascrizione della chiamata a fine sessione.
