# Voice Translate Demo

マイクに向かって話した内容を Web Speech API でリアルタイム文字起こしし、Chrome Built-in AI Translator API で翻訳結果を表示する、授業デモ向けの静的Webアプリです。

## 概要

- 日本語音声を認識して、日本語原文と英語翻訳を表示します。
- 英語音声を認識して、英語原文と日本語翻訳を表示します。
- 発話ごとに原文と翻訳を1カードとして会話ログに追加します。
- 新しい発話ほど上に表示され、自動で最新カードが見える位置へスクロールします。
- 大型モニターでも読みやすいように、文字サイズを小・中・大から切り替えられます。
- HTML / CSS / JavaScript のみで実装しているため、ビルド不要で GitHub Pages にそのまま公開できます。

## 使い方

1. Chromeで `index.html` または GitHub Pages のURLを開きます。
2. 翻訳モードを選びます。
   - `日本語 → 英語`
   - `English → Japanese`
3. `開始` ボタンを押します。
4. マイク使用許可が表示されたら `許可` を選びます。
5. マイクに向かって話すと、途中結果が表示され、確定した発話が会話ログに追加されます。
6. 停止したいときは `停止`、表示を消したいときは `ログを消去` を押します。
7. 教室の画面サイズに合わせて、`文字サイズ` の `小` / `中` / `大` を切り替えられます。

## 対応ブラウザ

主な対象は Chrome です。

- 音声認識: Web Speech API の `SpeechRecognition` または `webkitSpeechRecognition` が必要です。
- 翻訳: Chrome Built-in AI Translator API の `Translator` が必要です。

FirefoxやSafariなど、これらのAPIに対応していないブラウザでは動作しない、または翻訳できない場合があります。

## 無料APIのみで動作

このアプリは有料APIを使いません。APIキーも不要です。

使用しているAPIは次のブラウザ内蔵APIのみです。

- Web Speech API
- Chrome Built-in AI Translator API

非公式のGoogle翻訳API、スクレイピング、外部の有料翻訳APIは使用していません。

## 翻訳APIが使えない場合

Chrome Built-in AI Translator API が利用できない環境では、翻訳欄に次のメッセージを表示します。

`この環境ではブラウザ内蔵翻訳APIが利用できません`

この場合でも、Web Speech API が利用できる環境であれば音声認識の結果は表示できますが、翻訳はできません。

## 翻訳できないときの確認

音声認識はできるのに翻訳だけ失敗する場合は、Chrome Built-in AI Translator API の準備に失敗している可能性があります。

1. デスクトップ版 Chrome 138 以降で開いているか確認します。
2. Chromeのアドレスバーで `chrome://flags/#translation-api` を開きます。
3. `Translation API` を `Enabled` に変更します。
4. Chromeを再起動します。
5. もう一度GitHub PagesのURLを開き、`開始` を押します。

初回は翻訳モデルのダウンロードに時間がかかる場合があります。ダウンロード中はこのタブを開いたまま待ってください。

## GitHub Pagesで公開する方法

1. このリポジトリをGitHubへpushします。
2. GitHubのリポジトリページで `Settings` を開きます。
3. 左メニューから `Pages` を開きます。
4. `Build and deployment` の `Source` で `Deploy from a branch` を選びます。
5. `Branch` で `main`、フォルダで `/root` を選び、保存します。
6. 数分後に表示されるGitHub PagesのURLへアクセスします。

## ファイル構成

```text
voice-translate-demo/
├── index.html
├── style.css
├── script.js
└── README.md
```

## 注意

- マイク入力を使うため、GitHub PagesなどのHTTPS環境、または `localhost` で開いてください。
- Translator API は対応状況がブラウザや設定に依存します。
- 翻訳モデルの初回準備に時間がかかる場合があります。
