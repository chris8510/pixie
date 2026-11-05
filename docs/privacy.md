# Pixie – Privacy Policy / Datenschutzerklärung

*Last updated / Stand: 5 November 2026*

[English](#english) · [Deutsch](#deutsch)

---

## English

Pixie is a desktop app that shows what Claude Code is doing on your computer. It is an independent open-source project by chris85 ([github.com/chris8510/pixie](https://github.com/chris8510/pixie)), not affiliated with Anthropic or OpenAI.

### In short

**Pixie does not collect, store or send any personal data to the developer or to third parties.** There are no accounts, no analytics, no tracking and no advertising.

### What stays on your computer

- **Claude Code status.** Claude Code reports its activity (e.g. the task you typed, the tool it is using, file names) to Pixie through hooks. These messages go only to `127.0.0.1` – your own computer – and are kept in memory only while Pixie runs. They are not written to disk and never leave your computer.
- **Voice input.** When you use the microphone button, the recording is transcribed **on your computer** with the Whisper speech model. The audio is not stored and is not uploaded anywhere. The microphone is only used while you are recording; you can turn voice input off in the settings.
- **Settings and pets.** Your settings and your own pets are stored in the folder `.pixie` in your user folder; window position and choices in the app's data folder.
- **Claude Code settings.** When you click "Connect to Claude Code", Pixie adds its hooks to Claude Code's settings file (`.claude/settings.json` in your user folder). A backup of that file is made first. "Disconnect from Claude Code" removes them again.

### Network access

- **Speech model download.** The first time you use voice input, Pixie downloads the Whisper speech model (about 85 MB) once from Hugging Face (huggingface.co). This request contains no personal data; like any download, Hugging Face can see your IP address. See [Hugging Face's privacy policy](https://huggingface.co/privacy).
- **Quick questions.** When you ask Claude something through Pixie, Pixie starts the Claude Code program installed on your computer. Claude Code then communicates with Anthropic exactly as it does when you use it yourself, under your own Anthropic account and [Anthropic's privacy policy](https://www.anthropic.com/legal/privacy). Pixie does not see or keep anything beyond the answer it shows you.
- **Nothing else.** Pixie has no other network connections.

### Children

Pixie is a developer tool and is not directed at children.

### Changes and contact

If this policy changes, the new version will be published at this address with a new date. Questions: please open an issue at [github.com/chris8510/pixie/issues](https://github.com/chris8510/pixie/issues).

---

## Deutsch

Pixie ist eine Desktop-App, die anzeigt, was Claude Code auf deinem Rechner gerade tut. Es ist ein unabhängiges Open-Source-Projekt von chris85 ([github.com/chris8510/pixie](https://github.com/chris8510/pixie)) und steht in keiner Verbindung zu Anthropic oder OpenAI.

### Kurz gesagt

**Pixie erhebt, speichert oder übermittelt keine personenbezogenen Daten an den Entwickler oder an Dritte.** Es gibt keine Konten, keine Analyse, kein Tracking und keine Werbung.

### Was auf deinem Rechner bleibt

- **Status von Claude Code.** Claude Code meldet Pixie über Hooks, was es gerade tut (z. B. die eingegebene Aufgabe, das verwendete Tool, Dateinamen). Diese Meldungen gehen nur an `127.0.0.1`, also an deinen eigenen Rechner, und werden nur im Arbeitsspeicher gehalten, solange Pixie läuft. Sie werden nicht auf die Festplatte geschrieben und verlassen deinen Rechner nie.
- **Spracheingabe.** Nutzt du den Mikrofon-Knopf, wird die Aufnahme **auf deinem Rechner** mit dem Sprachmodell Whisper in Text umgewandelt. Die Aufnahme wird weder gespeichert noch hochgeladen. Das Mikrofon ist nur während der Aufnahme aktiv; die Spracheingabe lässt sich in den Einstellungen abschalten.
- **Einstellungen und Pets.** Einstellungen und eigene Pets liegen im Ordner `.pixie` in deinem Benutzerordner, Fensterposition und Auswahl im Datenordner der App.
- **Einstellungen von Claude Code.** Klickst du auf „Mit Claude Code verbinden“, trägt Pixie seine Hooks in die Einstellungsdatei von Claude Code ein (`.claude/settings.json` in deinem Benutzerordner). Vorher wird eine Sicherungskopie angelegt. „Verbindung zu Claude Code entfernen“ nimmt sie wieder heraus.

### Netzwerkzugriffe

- **Download des Sprachmodells.** Beim ersten Benutzen der Spracheingabe lädt Pixie einmalig das Sprachmodell Whisper (ca. 85 MB) von Hugging Face (huggingface.co). Die Anfrage enthält keine personenbezogenen Daten; wie bei jedem Download sieht Hugging Face dabei deine IP-Adresse. Siehe [Datenschutzerklärung von Hugging Face](https://huggingface.co/privacy).
- **Schnellfragen.** Fragst du Claude über Pixie etwas, startet Pixie das auf deinem Rechner installierte Claude Code. Claude Code kommuniziert dann genauso mit Anthropic, wie wenn du es selbst benutzt – mit deinem eigenen Anthropic-Konto und gemäß der [Datenschutzerklärung von Anthropic](https://www.anthropic.com/legal/privacy). Pixie sieht und speichert dabei nichts außer der Antwort, die es dir anzeigt.
- **Sonst nichts.** Weitere Netzwerkverbindungen baut Pixie nicht auf.

### Kinder

Pixie ist ein Entwicklerwerkzeug und richtet sich nicht an Kinder.

### Änderungen und Kontakt

Ändert sich diese Erklärung, wird die neue Fassung unter dieser Adresse mit neuem Datum veröffentlicht. Fragen bitte als Issue unter [github.com/chris8510/pixie/issues](https://github.com/chris8510/pixie/issues).
