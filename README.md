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

## Accesso con passphrase

Prima di arrivare alla schermata principale, l'app chiede una passphrase condivisa
(salvata poi nel browser, non richiesta più su quel dispositivo finché non cancelli
i dati del sito). Serve solo a tenere fuori visitatori casuali (un link indicizzato
da un motore di ricerca, qualcuno che trova il repository per caso) — **non è vera
sicurezza**: il codice di `app.js` (hash della passphrase incluso) resta comunque
leggibile da chiunque apra gli strumenti sviluppatore del browser sulla pagina
pubblicata, come qualsiasi cosa scritta in un sito statico senza un server dietro.
Va bene per tenere fuori i curiosi, non per proteggere davvero l'accesso da chi la
cerca apposta.

Per cambiare la passphrase, genera il nuovo hash SHA-256 e sostituisci la costante
`PASSPHRASE_HASH_HEX` in cima ad `app.js` — le istruzioni sono nel commento sopra
quella riga.

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

- **Nessun server TURN di default**: la connessione video prova a essere diretta tra i due
  dispositivi. Su molte reti va bene così, ma su altre (doppio NAT, CGNAT delle reti mobili,
  alcune reti domestiche, VPN aziendali, firewall restrittivi) il collegamento diretto fallisce
  e la chiamata cade dopo pochi secondi. Più sotto, in "Risoluzione problemi", trovi come
  aggiungere gratuitamente un server TURN per risolvere in modo stabile.
- **Riconoscimento vocale solo su Chrome/Edge**: su Firefox e Safari i sottotitoli non
  funzionano — non è un problema di configurazione, questi browser non implementano l'API di
  riconoscimento vocale che l'app usa. Inoltre Chrome/Edge inviano l'audio ai server di Google
  per trascriverlo (non è un'elaborazione 100% locale) — da tenere presente per conversazioni
  sensibili.
- **Traduzione: due motori, con limiti diversi.** L'app prova prima il **traduttore integrato
  nel browser** (Translator API, da Chrome 138 ed Edge 148 in poi, **solo su desktop**): gira in
  locale sul dispositivo, è gratuito, non ha limiti giornalieri e non manda il testo a nessun
  server esterno — la prima volta che serve una coppia di lingue il browser scarica da solo il
  modello. Dove non è disponibile (oggi: tutti i cellulari, e i browser non aggiornati) si ricade
  su **MyMemory**, gratuito ma con un tetto giornaliero per indirizzo IP: circa 5.000 caratteri
  in forma anonima. Il limite sale a circa 50.000 caratteri al giorno indicando un'email — senza
  registrarsi, basta scriverla nella costante `MYMEMORY_EMAIL` in cima ad `app.js`. A quota
  esaurita i sottotitoli restano nella lingua originale e compare un avviso nella trascrizione,
  invece di mostrare il messaggio d'errore di MyMemory al posto del testo tradotto.
- **Un solo ambiente per volta**: pensato per 2 persone, non per chiamate di gruppo.
- **Il codice di chiamata non è privato**: chiunque conosca il codice generato potrebbe, in
  teoria, provare a connettersi. Va condiviso solo con la persona giusta e usato per chiamate
  singole (ogni "Crea chiamata" genera un codice nuovo).

## Risoluzione problemi

- **"Non trascrive niente" su Firefox.** Non è risolvibile lato app: Firefox non implementa
  l'API di riconoscimento vocale del browser (Chrome e Edge sì). Serve usare Chrome o Edge sul
  dispositivo da cui parli; su Firefox l'app resta utilizzabile per la sola videochiamata.
- **La chiamata cade dopo pochi secondi.** Anche tra due reti Wi-Fi domestiche diverse questo
  è quasi sempre lo stesso problema: senza un server TURN, il collegamento diretto tra i due
  dispositivi fallisce ogni volta che almeno una delle due reti usa un NAT "difficile"
  (doppio NAT, CGNAT — molto comune su reti mobili e su alcuni router domestici/ISP). Non è un
  guasto dell'app, è un limite intrinseco del "niente server in mezzo, tutto gratis": la
  soluzione stabile è aggiungere un server TURN gratuito:

  1. Registrati su [dashboard.metered.ca/signup](https://dashboard.metered.ca/signup) (gratis,
     20 GB/mese inclusi).
  2. Nel pannello, genera una credenziale ("Generate your first credential").
  3. Clicca su **"Instructions"** e copia l'array `iceServers` che ti mostra (contiene URL,
     username e credential).
  4. Apri `app.js`, trova la costante `ICE_SERVERS` in cima al file e sostituiscila con
     l'array appena copiato (lasciando anche la riga dello STUN di Google va bene).
  5. Ricarica i file sul repository — GitHub Pages li ripubblica in automatico.

  Nel frattempo, l'app prova comunque a riconnettersi da sola per le interruzioni brevi della
  segnalazione, e se la chiamata cade davvero torna alla schermata iniziale con un messaggio
  chiaro invece di sparire senza spiegazioni.
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
