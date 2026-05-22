const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const clearButton = document.getElementById("clearButton");
const modeSelect = document.getElementById("modeSelect");
const statusText = document.getElementById("statusText");
const statusDot = document.getElementById("statusDot");
const supportMessage = document.getElementById("supportMessage");
const interimText = document.getElementById("interimText");
const conversationLog = document.getElementById("conversationLog");
const logCount = document.getElementById("logCount");
const fontSizeButtons = document.querySelectorAll("[data-font-size]");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const FONT_SIZE_STORAGE_KEY = "voiceTranslateFontSize";
const FONT_SIZES = ["small", "medium", "large"];

const MODES = {
  "ja-en": {
    label: "日本語 → 英語",
    recognitionLanguage: "ja-JP",
    sourceLanguage: "ja",
    targetLanguage: "en",
    sourceLabel: "日本語原文",
    translationLabel: "English translation",
  },
  "en-ja": {
    label: "English → Japanese",
    recognitionLanguage: "en-US",
    sourceLanguage: "en",
    targetLanguage: "ja",
    sourceLabel: "English original",
    translationLabel: "日本語翻訳",
  },
};

let recognition = null;
let isListening = false;
let shouldKeepListening = false;
let recognitionHadBlockingError = false;
let currentTranslator = null;
let currentTranslatorPromise = null;
let currentTranslatorKey = "";
let logTotal = 0;

// 画面の状態表示を一箇所で更新する。
function setStatus(label, type = "idle") {
  statusText.textContent = label;
  statusDot.className = "status-dot";

  if (type === "listening") {
    statusDot.classList.add("listening");
  }

  if (type === "error") {
    statusDot.classList.add("error");
  }
}

function setSupportMessage(message, type = "") {
  supportMessage.textContent = message;
  supportMessage.className = `support-message ${type}`.trim();
}

function getMode() {
  return MODES[modeSelect.value] || MODES["ja-en"];
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

function updateLogCount() {
  logCount.textContent = `${logTotal} 件`;
}

function applyFontSize(size) {
  const selectedSize = FONT_SIZES.includes(size) ? size : "medium";
  document.body.dataset.fontSize = selectedSize;

  fontSizeButtons.forEach((button) => {
    const isActive = button.dataset.fontSize === selectedSize;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  try {
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, selectedSize);
  } catch (error) {
    console.warn("文字サイズ設定を保存できませんでした。", error);
  }
}

function removeEmptyState() {
  const emptyState = conversationLog.querySelector(".empty-state");
  if (emptyState) {
    emptyState.remove();
  }
}

function formatTime(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function addLogCard(sourceText, translationText, mode, translationState = "ok") {
  removeEmptyState();

  const card = document.createElement("article");
  card.className = "log-card";
  card.tabIndex = -1;
  card.innerHTML = `
    <div class="log-meta">
      <span>${escapeHtml(mode.label)}</span>
      <span>${formatTime(new Date())}</span>
    </div>
    <div>
      <p class="section-label">${escapeHtml(mode.sourceLabel)}</p>
      <p class="source-text">${escapeHtml(sourceText)}</p>
    </div>
    <div>
      <p class="section-label">${escapeHtml(mode.translationLabel)}</p>
      <p class="translation-text ${translationState}">${escapeHtml(translationText)}</p>
    </div>
  `;

  // 新しいカードをログの先頭に追加し、授業中にすぐ読める位置へ自動スクロールする。
  conversationLog.prepend(card);
  conversationLog.scrollTop = 0;
  requestAnimationFrame(() => {
    card.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  logTotal += 1;
  updateLogCount();
}

function resetLog() {
  conversationLog.innerHTML = `
    <article class="empty-state">
      <p>まだ発話はありません。</p>
      <span>「開始」を押して、マイクに向かって話してください。</span>
    </article>
  `;
  logTotal = 0;
  updateLogCount();
}

function describeRecognitionError(error) {
  const messages = {
    "not-allowed": "マイクの使用が許可されていません。ブラウザの権限設定を確認してください。",
    "service-not-allowed": "音声認識サービスの使用が許可されていません。",
    "no-speech": "音声が検出されませんでした。もう一度話してください。",
    "audio-capture": "マイクが見つかりません。接続や入力設定を確認してください。",
    network: "音声認識でネットワークエラーが発生しました。",
    aborted: "音声認識が停止されました。",
  };

  return messages[error] || `音声認識エラー: ${error}`;
}

function getTranslatorGlobal() {
  return window.Translator || null;
}

function getTranslatorSetupHelp() {
  return "Chrome 138以降のデスクトップ版Chromeで、chrome://flags/#translation-api を Enabled にして再起動してください。初回は翻訳モデルのダウンロードに時間がかかる場合があります。";
}

function describeTranslatorError(error) {
  const detail = [error?.name, error?.message].filter(Boolean).join(": ");

  if (!detail) {
    return `翻訳APIの準備中にエラーが発生しました。${getTranslatorSetupHelp()}`;
  }

  return `翻訳APIの準備中にエラーが発生しました (${detail})。${getTranslatorSetupHelp()}`;
}

function handleTranslatorDownloadProgress(event) {
  const loaded = Number(event.loaded);
  const total = Number(event.total);
  let percent = "";

  if (Number.isFinite(loaded) && loaded >= 0 && loaded <= 1) {
    percent = ` ${Math.round(loaded * 100)}%`;
  } else if (Number.isFinite(loaded) && Number.isFinite(total) && total > 0) {
    percent = ` ${Math.round((loaded / total) * 100)}%`;
  }

  setSupportMessage(`翻訳モデルをダウンロード中です${percent}。完了までこのタブを開いたまま待ってください。`, "warning");
}

async function getTranslator(mode) {
  const TranslatorGlobal = getTranslatorGlobal();
  const unavailableMessage = "この環境ではブラウザ内蔵翻訳APIが利用できません";

  if (!TranslatorGlobal || typeof TranslatorGlobal.create !== "function") {
    return { translator: null, message: unavailableMessage, state: "unavailable" };
  }

  const key = `${mode.sourceLanguage}-${mode.targetLanguage}`;
  if (currentTranslator && currentTranslatorKey === key) {
    return { translator: currentTranslator, message: "", state: "ok" };
  }

  if (currentTranslatorPromise && currentTranslatorKey === key) {
    try {
      currentTranslator = await currentTranslatorPromise;
      return { translator: currentTranslator, message: "", state: "ok" };
    } catch (error) {
      console.error(error);
      return { translator: null, message: describeTranslatorError(error), state: "error" };
    }
  }

  try {
    // Translator.create() はユーザー操作直後に呼ぶ必要があるため、availability() を待たずに作成する。
    currentTranslatorKey = key;
    currentTranslatorPromise = TranslatorGlobal.create({
      sourceLanguage: mode.sourceLanguage,
      targetLanguage: mode.targetLanguage,
      monitor(monitor) {
        monitor.addEventListener("downloadprogress", handleTranslatorDownloadProgress);
      },
    }).then(async (translator) => {
      if (translator.ready) {
        await translator.ready;
      }
      return translator;
    });

    currentTranslator = await currentTranslatorPromise;

    return { translator: currentTranslator, message: "", state: "ok" };
  } catch (error) {
    console.error(error);
    currentTranslator = null;
    currentTranslatorPromise = null;
    currentTranslatorKey = "";
    return {
      translator: null,
      message: describeTranslatorError(error),
      state: "error",
    };
  }
}

async function translateText(text, mode) {
  setStatus("翻訳中", "listening");

  const result = await getTranslator(mode);
  if (!result.translator) {
    setSupportMessage(result.message, result.state === "error" ? "error" : "warning");
    return { text: result.message, state: result.state };
  }

  try {
    const translatedText = await result.translator.translate(text);
    setSupportMessage("翻訳が完了しました。続けて話せます。");
    return { text: translatedText, state: "ok" };
  } catch (error) {
    console.error(error);
    return { text: "翻訳中にエラーが発生しました", state: "error" };
  }
}

async function prepareTranslatorForCurrentMode() {
  const result = await getTranslator(getMode());

  if (!result.translator && result.message) {
    setSupportMessage(result.message, result.state === "error" ? "error" : "warning");
    return;
  }

  setSupportMessage("翻訳APIを準備しました。マイクの使用許可を求められたら「許可」を選んでください。");
}

function configureRecognition() {
  const mode = getMode();

  recognition = new SpeechRecognition();
  recognition.lang = mode.recognitionLanguage;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isListening = true;
    recognitionHadBlockingError = false;
    startButton.disabled = true;
    stopButton.disabled = false;
    setStatus("聞き取り中", "listening");
    setSupportMessage("聞き取り中です。話した内容は確定後にログへ追加されます。");
  };

  recognition.onresult = async (event) => {
    let interimTranscript = "";

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0].transcript.trim();

      if (!transcript) {
        continue;
      }

      if (event.results[index].isFinal) {
        const finalMode = getMode();
        interimText.textContent = "";
        const translation = await translateText(transcript, finalMode);
        addLogCard(transcript, translation.text, finalMode, translation.state);

        if (shouldKeepListening) {
          setStatus("聞き取り中", "listening");
        }
      } else {
        interimTranscript += transcript;
      }
    }

    if (interimTranscript) {
      interimText.textContent = interimTranscript;
    }
  };

  recognition.onerror = (event) => {
    const message = describeRecognitionError(event.error);
    setStatus("エラー", "error");
    setSupportMessage(message, "error");

    // 権限やマイク接続の問題では、自動再開せず利用者の操作を待つ。
    if (["not-allowed", "service-not-allowed", "audio-capture"].includes(event.error)) {
      recognitionHadBlockingError = true;
      shouldKeepListening = false;
      startButton.disabled = false;
      stopButton.disabled = true;
    }
  };

  recognition.onend = () => {
    isListening = false;

    // ブラウザ側で認識が自動終了した場合だけ再開する。
    if (shouldKeepListening) {
      try {
        recognition.start();
      } catch (error) {
        console.error(error);
        setStatus("エラー", "error");
        setSupportMessage("音声認識の再開に失敗しました。もう一度「開始」を押してください。", "error");
        startButton.disabled = false;
        stopButton.disabled = true;
        shouldKeepListening = false;
      }
      return;
    }

    startButton.disabled = false;
    stopButton.disabled = true;
    if (recognitionHadBlockingError) {
      return;
    }
    setStatus("停止中");
  };
}

function startListening() {
  if (!SpeechRecognition) {
    setStatus("エラー", "error");
    setSupportMessage("このブラウザでは Web Speech API の音声認識が利用できません。Chromeで開いてください。", "error");
    return;
  }

  if (isListening || shouldKeepListening) {
    return;
  }

  shouldKeepListening = true;
  configureRecognition();
  prepareTranslatorForCurrentMode();

  try {
    recognition.start();
  } catch (error) {
    console.error(error);
    shouldKeepListening = false;
    setStatus("エラー", "error");
    setSupportMessage("音声認識の開始に失敗しました。ページを再読み込みして再度お試しください。", "error");
  }
}

function stopListening() {
  shouldKeepListening = false;
  interimText.textContent = "停止しました。";

  if (recognition && isListening) {
    recognition.stop();
  } else {
    startButton.disabled = false;
    stopButton.disabled = true;
    setStatus("停止中");
  }
}

async function updateApiSupportMessage() {
  if (!SpeechRecognition) {
    setStatus("エラー", "error");
    setSupportMessage("このブラウザでは Web Speech API の音声認識が利用できません。Chromeで開いてください。", "error");
    startButton.disabled = true;
    return;
  }

  const TranslatorGlobal = getTranslatorGlobal();
  if (!TranslatorGlobal || typeof TranslatorGlobal.create !== "function") {
    setSupportMessage("この環境ではブラウザ内蔵翻訳APIが利用できません", "warning");
    return;
  }

  setSupportMessage("マイクの使用許可を求められたら「許可」を選んでください。");
}

startButton.addEventListener("click", startListening);
stopButton.addEventListener("click", stopListening);
clearButton.addEventListener("click", resetLog);

fontSizeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyFontSize(button.dataset.fontSize);
  });
});

modeSelect.addEventListener("change", () => {
  const mode = getMode();
  currentTranslator = null;
  currentTranslatorPromise = null;
  currentTranslatorKey = "";

  if (recognition && isListening) {
    stopListening();
  }

  interimText.textContent = `${mode.label} に切り替えました。`;
  setStatus("待機中");
  updateApiSupportMessage();
});

window.addEventListener("error", (event) => {
  console.error(event.error || event.message);
  setStatus("エラー", "error");
  setSupportMessage("予期しないエラーが発生しました。画面を再読み込みして再度お試しください。", "error");
});

try {
  applyFontSize(localStorage.getItem(FONT_SIZE_STORAGE_KEY) || "medium");
} catch (error) {
  console.warn("文字サイズ設定を読み込めませんでした。", error);
  applyFontSize("medium");
}

updateLogCount();
setStatus("待機中");
updateApiSupportMessage();
