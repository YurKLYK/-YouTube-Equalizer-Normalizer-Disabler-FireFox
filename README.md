# YouTube Equalizer & Normalizer Disabler

A professional-grade audio enhancement extension for YouTube. This tool allows users to bypass YouTube's automatic volume normalization and fine-tune their audio experience using a 3-band rotary equalizer, a preamp, and a brickwall limiter.

YouTubeの自動音量調整（ノーマライザー）を解除し、プロ仕様の3バンドEQ、プリアンプ、リミッターを提供するオーディオー向上拡張機能です。
このプログラムはnemy-new様が書いていますそれをfirefoxで動くようにAIですこしいじっただけのものです
なにか問題があればすぐ消しますm(_ _)m
元プロジェクトはこちらです　https://github.com/nemy-new/-YouTube-Equalizer-Normalizer-Disabler

## Features | 特徴

- **Normalizer Disabler**: Restores original track dynamics by disabling YouTube's automatic loudness leveling.
- **3-Band Rotary EQ**: High-quality control for Low, Mid, and High frequencies with a smooth, premium feel.
- **Preamp (Master Gain)**: Powerful overall volume control.
- **Brickwall Limiter**: Prevents all digital clipping and distortion even with heavy EQ boosts.
- **UI**: Sleek dark mode integration with glowing white meters.

---

- **ノーマライザー解除**: YouTube独自の音量平均化を無効化し、本来のダイナミクスを復元します。
- **3バンド・ロータリーEQ**: 低音・中域・高音を直感的に調整。滑らかで高級感のある操作感。
- **プリアンプ（メインボリューム）**: 全体的な音量を底上げ・調整。
- **ブリックウォール・リミッター**: 強力な過入力防止。極端な設定でも音割れを完全に防ぎます。
- **UI**: YouTubeのプレーヤーに溶け込むダークテーマと発光メーター。

## Installation | インストール方法

### Firefox (Temporary Add-on)
1. Clone this repository.
2. Create a copy of this folder for Firefox testing.
3. In the copied folder, rename `manifest.firefox.json` to `manifest.json`.
4. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
5. Click **Load Temporary Add-on...** and select the renamed `manifest.json`.

---

### デベロッパーモード（ローカル）
1. このリポジトリをクローンまたはダウンロードします。
2. Chromeで `chrome://extensions/` を開きます。
3. 右上の「デベロッパー モード」をオンにします。
4. 「パッケージ化されていない拡張機能を読み込む」を選択し、このディレクトリを指定します。

### Firefox（一時的なアドオンとして読み込み）
1. このリポジトリをクローンまたはダウンロードします。
2. Firefox検証用に、このフォルダのコピーを作成します。
3. コピー先で `manifest.firefox.json` を `manifest.json` にリネームします。
4. Firefoxで `about:debugging#/runtime/this-firefox` を開きます。
5. 「一時的なアドオンを読み込む」を選択し、リネームした `manifest.json` を指定します。

## License | ライセンス
MIT License

## Upstream Credit | 参考元
This project is based on the following upstream repository and includes local modifications for Firefox compatibility and packaging.

- Upstream: `https://github.com/nemy-new/-YouTube-Equalizer-Normalizer-Disabler`

---

このプロジェクトは以下の元リポジトリをベースに、Firefox互換対応およびパッケージング調整を加えたものです。

- 参考元: `https://github.com/nemy-new/-YouTube-Equalizer-Normalizer-Disabler`
