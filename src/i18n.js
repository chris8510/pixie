'use strict';

// UI strings. Language follows the system (or "language" in config.json).

const STRINGS = {
  de: {
    // status messages (state.js)
    ready: 'Bin bereit!',
    thinking: 'Denke nach…',
    compacting: 'Räume den Kontext auf…',
    done: 'Fertig!',
    needInput: 'Ich brauche dich kurz',
    waiting: 'Ich warte auf dich',
    permission: 'Darf ich {tool} benutzen?',
    read: 'Lese {f}', readAny: 'Lese Dateien…',
    edit: 'Bearbeite {f}', editAny: 'Bearbeite…',
    write: 'Schreibe {f}', writeAny: 'Schreibe…',
    grep: 'Suche „{q}“', glob: 'Suche Dateien {q}',
    websearch: 'Recherchiere {q}', webfetch: 'Lese {host}', webAny: 'Lese eine Webseite…',
    delegate: 'Delegiere: {d}', delegateAny: 'Delegiere an Subagent…',
    plan: 'Plane die nächsten Schritte', working: 'Arbeite…',
    asking: 'Frage Claude…', answered: 'Antwort ist da!', failed: 'Hat nicht geklappt',

    // renderer
    label_idle: 'Bereit', label_thinking: 'Denkt nach', label_working: 'Arbeitet',
    label_needsInput: 'Wartet auf dich', label_done: 'Fertig', label_error: 'Blockiert',
    active: '{n} aktiv',
    askPlaceholder: 'Claude kurz etwas fragen…', send: 'Senden',
    quickTitle: 'Schnellaktionen', answer: 'Antwort', error: 'Fehler', copy: 'Kopieren', close: 'Schließen',
    btnAsk: 'Claude fragen', btnVoice: 'Spracheingabe', btnReply: 'Letzte Antwort',
    listening: 'Ich höre zu…', listeningSub: 'Zum Beenden nochmal aufs Mikrofon klicken',
    transcribing: 'Verstehe…', modelLoading: 'Lade Sprachmodell (nur beim ersten Mal)',
    micDenied: 'Kein Zugriff aufs Mikrofon', micDeniedSub: 'Bitte in den Systemeinstellungen erlauben',
    nothingHeard: 'Nichts verstanden', nothingHeardSub: 'Versuch es nochmal etwas lauter',
    voiceOff: 'Spracheingabe ist ausgeschaltet', voiceFailed: 'Spracheingabe hat nicht geklappt',
    petLoadFailed: 'Pet konnte nicht geladen werden',
    connectTitle: 'Mit Claude Code verbinden', connectSub: 'Klicken, um die Hooks einzurichten',
    connected: 'Verbunden!', connectedSub: 'Neue Claude-Code-Sitzungen melden sich jetzt bei mir',
    connectFailed: 'Verbinden hat nicht geklappt',
    petTooltip: 'Klicken: hüpfen · Ziehen: verschieben · Rechtsklick: Menü',
    emptyQuick: 'Noch keine Schnellaktionen – trag sie in der config.json unter "prompts" ein.',

    // menu
    show: 'Einblenden', hide: 'Ausblenden', pet: 'Pet', alwaysOnTop: 'Immer im Vordergrund',
    resetPosition: 'Position zurücksetzen', hooksInstall: 'Mit Claude Code verbinden',
    hooksRemove: 'Verbindung zu Claude Code entfernen', openAtLogin: 'Bei Anmeldung starten',
    openSettings: 'Einstellungen öffnen', reload: 'Neu laden', quit: 'Pixie beenden',
    rescanPets: 'Pets neu einlesen', openPetFolder: 'Ordner für eigene Pets öffnen',
    src_builtin: 'Mitgeliefert', src_user: 'Eigene', src_codex: 'Codex',
    claudeNotFound: 'Claude Code wurde nicht gefunden – weder im PATH noch bei der Claude-Desktop-App. Trag den vollen Pfad in der config.json bei "claudeCommand" ein.',
    timeout: 'Abgebrochen nach {s} s.', emptyPrompt: 'Leerer Prompt.', noOutput: '(keine Ausgabe)',
    portBusy: 'Port {port} ist belegt',
    checkConnection: 'Verbindung prüfen',
    checkOk: 'Mit Claude Code verbunden',
    checkOkSub: 'Letzte Meldung vor {ago}',
    checkWaiting: 'Eingerichtet – noch keine Meldung',
    checkWaitingSub: 'Starte eine neue Sitzung in lokalem Claude Code (Terminal oder „Code“ in der App). Chats in der Cloud erreichen Pixie nicht.',
    checkNo: 'Nicht mit Claude Code verbunden',
    checkNoSub: 'Rechtsklick → „Mit Claude Code verbinden“',
    agoSec: '{n} s', agoMin: '{n} min', agoHour: '{n} h',
    petsFound: '{n} Pets gefunden', petsSkipped: 'Übersprungen: {list}', petsAllGood: 'Ordner: ~/.pixie/pets und ~/.codex/pets',
    searchingClaude: 'Suche Claude Code…',
    loginNeeded: 'Claude Code ist für Pixies Schnellfragen noch nicht angemeldet. Klick auf „Anmelden“: Es öffnet sich ein Terminal mit Claude Code. Gib dort einmal /login ein, melde dich an und stell die Frage danach nochmal.',
    loginNow: 'Anmelden',
    tuneMenu: 'Pet anpassen…', tuneTitle: 'Pet anpassen', petSize: 'Pet-Größe',
    petSizeHint: 'Passe die Größe deines Pets an', reset: 'Zurücksetzen',
  },
  en: {
    ready: 'Ready!',
    thinking: 'Thinking…',
    compacting: 'Compacting context…',
    done: 'Done!',
    needInput: 'Need you for a sec',
    waiting: 'Waiting for you',
    permission: 'May I use {tool}?',
    read: 'Reading {f}', readAny: 'Reading files…',
    edit: 'Editing {f}', editAny: 'Editing…',
    write: 'Writing {f}', writeAny: 'Writing…',
    grep: 'Searching “{q}”', glob: 'Finding files {q}',
    websearch: 'Researching {q}', webfetch: 'Reading {host}', webAny: 'Reading a web page…',
    delegate: 'Delegating: {d}', delegateAny: 'Delegating to a subagent…',
    plan: 'Planning next steps', working: 'Working…',
    asking: 'Asking Claude…', answered: 'Answer is ready!', failed: "That didn't work",

    label_idle: 'Ready', label_thinking: 'Thinking', label_working: 'Working',
    label_needsInput: 'Needs input', label_done: 'Done', label_error: 'Blocked',
    active: '{n} active',
    askPlaceholder: 'Ask Claude something…', send: 'Send',
    quickTitle: 'Quick actions', answer: 'Answer', error: 'Error', copy: 'Copy', close: 'Close',
    btnAsk: 'Ask Claude', btnVoice: 'Voice input', btnReply: 'Last answer',
    listening: 'Listening…', listeningSub: 'Click the microphone again to stop',
    transcribing: 'Transcribing…', modelLoading: 'Downloading speech model (first time only)',
    micDenied: 'No microphone access', micDeniedSub: 'Please allow it in your system settings',
    nothingHeard: "Didn't catch that", nothingHeardSub: 'Try again a little louder',
    voiceOff: 'Voice input is turned off', voiceFailed: 'Voice input failed',
    petLoadFailed: 'Could not load pet',
    connectTitle: 'Connect to Claude Code', connectSub: 'Click to set up the hooks',
    connected: 'Connected!', connectedSub: 'New Claude Code sessions will now report to me',
    connectFailed: 'Could not connect',
    petTooltip: 'Click: hop · Drag: move · Right-click: menu',
    emptyQuick: 'No quick actions yet – add them under "prompts" in config.json.',

    show: 'Show', hide: 'Hide', pet: 'Pet', alwaysOnTop: 'Always on top',
    resetPosition: 'Reset position', hooksInstall: 'Connect to Claude Code',
    hooksRemove: 'Disconnect from Claude Code', openAtLogin: 'Open at login',
    openSettings: 'Open settings', reload: 'Reload', quit: 'Quit Pixie',
    rescanPets: 'Rescan pets', openPetFolder: 'Open folder for your pets',
    src_builtin: 'Built-in', src_user: 'Your pets', src_codex: 'Codex',
    claudeNotFound: 'Claude Code was not found – neither on PATH nor in the Claude desktop app. Set its full path as "claudeCommand" in config.json.',
    timeout: 'Cancelled after {s} s.', emptyPrompt: 'Empty prompt.', noOutput: '(no output)',
    portBusy: 'Port {port} is already in use',
    checkConnection: 'Check connection',
    checkOk: 'Connected to Claude Code',
    checkOkSub: 'Last report {ago} ago',
    checkWaiting: 'Set up – no report yet',
    checkWaitingSub: 'Start a new session in local Claude Code (terminal or "Code" in the app). Cloud chats can\'t reach Pixie.',
    checkNo: 'Not connected to Claude Code',
    checkNoSub: 'Right-click → "Connect to Claude Code"',
    agoSec: '{n} s', agoMin: '{n} min', agoHour: '{n} h',
    petsFound: '{n} pets found', petsSkipped: 'Skipped: {list}', petsAllGood: 'Folders: ~/.pixie/pets and ~/.codex/pets',
    searchingClaude: 'Looking for Claude Code…',
    loginNeeded: "Claude Code isn't logged in for Pixie's quick questions yet. Click \"Log in\": a terminal with Claude Code opens. Type /login there once, sign in, then ask again.",
    loginNow: 'Log in',
    tuneMenu: 'Customize pet…', tuneTitle: 'Customize pet', petSize: 'Pet size',
    petSizeHint: 'Adjust the size of your pet', reset: 'Reset',
  },
};

const DEFAULT_PROMPTS = {
  de: [
    { label: 'Was hat sich geändert?', prompt: 'Fasse in höchstens 4 Stichpunkten zusammen, was sich im aktuellen Git-Repository seit dem letzten Commit geändert hat.' },
    { label: 'Commit-Nachricht', prompt: 'Schlag eine prägnante Commit-Nachricht (Conventional Commits) für die aktuellen Änderungen vor. Sieh dir dafür git diff an. Antworte nur mit der Nachricht.' },
    { label: 'Letzte Commits', prompt: 'Erklär mir in 3 kurzen Sätzen, woran in den letzten 10 Commits gearbeitet wurde.' },
  ],
  en: [
    { label: 'What changed?', prompt: 'Summarize in at most 4 bullet points what changed in the current git repository since the last commit.' },
    { label: 'Commit message', prompt: 'Suggest a concise commit message (Conventional Commits) for the current changes. Look at git diff. Reply with the message only.' },
    { label: 'Recent commits', prompt: 'Explain in 3 short sentences what the last 10 commits worked on.' },
  ],
};

function pickLanguage(preferred, locale) {
  const want = preferred && preferred !== 'auto' ? preferred : String(locale || 'en');
  return want.toLowerCase().startsWith('de') ? 'de' : 'en';
}

function translator(lang) {
  const table = STRINGS[lang] || STRINGS.en;
  return (key, vars = {}) => String(table[key] ?? STRINGS.en[key] ?? key)
    .replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

module.exports = { STRINGS, DEFAULT_PROMPTS, pickLanguage, translator };
