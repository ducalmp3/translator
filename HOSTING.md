# Come mettere online VideoTraduci (gratis) — GitHub Pages

Serve perché l'app va data in pasto a un vero indirizzo HTTPS pubblico: così chi la usa
non deve più installare nulla né avviare un server sul proprio computer, basta aprire un
link. GitHub Pages fa esattamente questo, gratis, per sempre, per siti statici come questo
(nessun database o codice lato server da gestire).

## Cosa ti serve

- Un account GitHub gratuito: [github.com/signup](https://github.com/signup) (bastano
  pochi minuti se non ne hai già uno).
- I 5 file dell'app: `index.html`, `style.css`, `app.js`, `i18n.js`, `README.md`.

Non serve installare Git né sapere usare la riga di comando: si può fare tutto dal sito
di GitHub, caricando i file con il mouse.

## Passaggi

1. **Crea un nuovo repository.** Su github.com, in alto a destra clicca sul **"+"** →
   **"New repository"**. Dagli un nome (es. `videotraduci`), lascialo **Public** (deve
   restare pubblico per usare Pages gratuitamente con un account personale — non è un
   problema, il codice non contiene nulla di segreto), poi **"Create repository"**.

2. **Carica i file.** Nella pagina del repository appena creato, clicca **"uploading an
   existing file"** (o "Add file" → "Upload files" se il repository non è più vuoto).
   Trascina dentro tutti e 5 i file del progetto, poi in basso scrivi un breve messaggio
   (es. "prima versione") e clicca **"Commit changes"**.

3. **Attiva GitHub Pages.** Vai su **Settings** (in alto nel repository) → nel menu a
   sinistra **Pages**. Sotto "Build and deployment" → "Source" scegli **"Deploy from a
   branch"**, poi come branch scegli **main** e come cartella **/ (root)**, infine
   **Save**.

4. **Aspetta circa un minuto e ricarica la pagina Settings → Pages.** Comparirà un
   messaggio con l'indirizzo pubblico, del tipo:

   ```
   https://<tuo-username>.github.io/videotraduci/
   ```

5. **Apri quel link in Chrome o Edge** e verifica che il browser chieda il permesso per
   microfono e videocamera (se lo chiede, significa che tutto funziona: HTTPS è attivo,
   condizione necessaria per WebRTC e per il riconoscimento vocale).

6. **Condividi quel link** con chiunque voglia usarla insieme a te: basta che entrambi lo
   apriate — non serve più nessun server locale, nessun terminale, nessuna installazione.

## Come aggiornare l'app in futuro

Ogni volta che modifichi un file (es. per correggere qualcosa), torna nella pagina del
repository su GitHub, apri il file interessato, clicca sulla matita (Edit) in alto a
destra, incolla il contenuto aggiornato e clicca **"Commit changes"**. GitHub Pages
ripubblica automaticamente la nuova versione in meno di un minuto, allo stesso indirizzo.

## Alternative altrettanto gratuite (se preferisci non usare GitHub)

- **Netlify Drop** ([app.netlify.com/drop](https://app.netlify.com/drop)): trascini la
  cartella del progetto nel browser e ottieni subito un indirizzo HTTPS pubblico, senza
  nemmeno creare un account (utile per un test al volo; per un indirizzo stabile nel
  tempo conviene comunque registrarsi, sempre gratis).
- **Vercel** (vercel.com): simile a Netlify, richiede un account gratuito ma il
  deployment è altrettanto immediato trascinando la cartella nella dashboard.

Tutte e tre le opzioni sono gratuite per un uso personale come questo, senza limiti di
tempo, e nessuna richiede una carta di credito.
