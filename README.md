# TypeScript 型定義パフォーマンス検証デモ
**— type 交差型（`&`）vs interface 継承（`extends`）—**

このリポジトリは、TypeScript における **`type` 交差型**と **`interface extends`** の**型チェック時間（Check time）**の差を、最小構成で再現・計測するためのデモです。
React の Props（オブジェクト形状）を題材に、`tsc --extendedDiagnostics` と OS の `/usr/bin/time` を使って定量比較します。

---

## 1. 要件

- Node.js 18+（例: v24 系で検証）
- npm（または pnpm/yarn に読み替え可）

---

## 2. セットアップ

```bash
# 依存をインストール
npm i

# 初回データ生成（デフォルト N=400 要素）
npx ts-node scripts/generate.ts
```

## 3. 計測（CLI）

### 3.1 tsc の詳細診断で計測
```bash
# 交差型（type &）の計測
npm run bench:type

# interface（extends）の計測
npm run bench:iface
```

- extendedDiagnostics により、Check time（型検査に要した純時間）や Memory used 等を表示します。

- 比較の主軸は Check time です。ここがコンパイル体感に最も効きます。


### 3.2 規模（N）を変える
```bash
# 1000 要素に増やして再生成
npx ts-node scripts/generate.ts 1000
npm run bench:type
npm run bench:iface

# 2000 要素
npx ts-node scripts/generate.ts 2000
npm run bench:type
npm run bench:iface
```
- N を上げるほど、交差型（type &）側だけが非線形に悪化しやすいのが観測できます。
- interface 側は「遅延評価＋参照再利用」により伸びが緩やかです。

### 3.3 OS の /usr/bin/time で実時間も収集（任意）
```bash
/usr/bin/time -lp npm run bench:type
/usr/bin/time -lp npm run bench:iface
```
- real（経過時間）と maximum resident set size（最大常駐メモリ）を CI 比較用に記録できます。

## 4. エディタ（VSCode）での体感比較

1. VSCode でこのリポジトリを開く
2. `src/type-version/Component.tsx` と `src/interface-version/Component.tsx` を比較
   - `HugeProps` に **ホバー**した際の表示レスポンスを確認
   - **補完候補**の表示速度（レイテンシ）を確認
   - 編集中の CPU 使用率をタスクマネージャで観察
3. 詳細なログを取得する場合：
   コマンドパレットで **「TypeScript: Open TS Server log」** を実行し、
   ホバーまたは補完操作後の処理時間を比較します。

> `type &` 側はホバー展開時に具体的な構造を即時計算するため、
> 補完やホバー応答が数倍遅くなる傾向があります。
> 一方 `interface extends` 側は遅延展開のため、編集体感が軽快になります。

---

## 5. 期待される観測傾向（例）

| 要素数 (N) | type（交差型）Check time | interface（extends）Check time | 備考 |
|-----------:|--------------------------:|-------------------------------:|:-----|
| 400        | ~0.15s                   | ~0.07s                         | interface が約 2.1 倍速い |
| 1000       | ~0.66s                   | ~0.21s                         | 約 3.1 倍 |
| 2000       | ~2.25s                   | ~0.70s                         | 約 3.2 倍／非線形差が明確 |

> ※ 実行環境により差は前後します。複数回（2〜3 回）実行し、中央値を採用すると精度が上がります。

---

## 6. プロジェクト構成
```
ts-perf-demo/
├─ package.json
├─ tsconfig.base.json
├─ tsconfig.type.json # 交差型側のビルド設定
├─ tsconfig.interface.json # interface 側のビルド設定
├─ scripts/
│ └─ generate.ts # 型定義自動生成スクリプト
└─ src/
├─ type-version/
│ ├─ generated.types.ts # 交差型（type &）群
│ └─ Component.tsx
└─ interface-version/
├─ generated.interfaces.ts # interface（extends）群
└─ Component.tsx
```

---

## 7. なぜ差が出るのか（要点）

- **type（交差型）＝即時評価（Eager Evaluation）**
  - 各交差演算子 `&` のたびに構造を再帰的に展開
  - 複雑な型合成で **構造爆発** が起こりやすく、非線形に遅延
  - キャッシュ効率が悪く、Check time が急増する
- **interface（継承）＝遅延評価（Lazy Evaluation）**
  - 型の実体を必要になるまで展開せず、**名前単位でキャッシュ可能**
  - 評価コストが分散されるため、スケールしても安定
  - 大規模プロジェクトでも型検査が軽快

---

## 8. 応用（現場寄りの重いケースを再現）

`scripts/generate.ts` の **type 版**の `HugeProps` を以下のように変更し、
マップド型・条件型を混在させて複雑化することで差をさらに顕著にできます。

```ts
type Widen<T> = { [K in keyof T]-?: T[K] };
type Decorate<T> = Readonly<Pick<T, keyof T>> & Partial<T>;
type Maybe<T> = T extends { k0_a: any } ? T & { __flag__?: true } : T;

export type HugeProps = Decorate<Maybe<ButtonBaseProps & IconProps & Mega>>;
```

`interface` 側はそのまま `extends` 連結で問題ありません。
この構造では、TypeScript コンパイラが型を「名前付きシンボル」として扱うため、
展開を後回しにでき、型キャッシュが効率的に利用されます。
その結果、同じ構造を持つ `type &` 版よりも **Check time が短く、非線形な増加を回避** できます。

---

## 9. 実務での運用指針

- **Props やオブジェクト構造は基本 `interface` を使用**
  - 特に React コンポーネントの Props 定義や API レスポンス型など、
    頻繁に合成・継承される型では `interface` が有利です。
- **`type` は以下の用途に限定**
  - **ユニオン型**（例：`type Status = 'success' | 'error'`）
  - **タプル型**（例：`type Point = [number, number]`）
  - **条件型 / 補助ユーティリティ型**（例：`type Maybe<T> = T | null`）
  - **プリミティブ別名**（例：`type ID = string`）
- **ESLint ルールで統一する例：**
  ```json
  {
    "rules": {
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"]
    }
  }
  ```

- **補助型で可読性を補う**
  展開が必要な箇所のみ `Simplify<T>` のような補助型を使用し、
  開発体験（型の見やすさ）を維持しつつ、構造爆発を防ぎます。

  ```ts
  // 型の展開を局所的に行いたい場合の例
  type Simplify<T> = { [K in keyof T]: T[K] };

  // 例：Props の最終段階のみ可読化
  type FinalProps = Simplify<HugeProps>;

> ⚠️ **注意:** `Simplify<T>` は非常に便利ですが、**適用範囲を誤ると再び型展開コストが急増**します。
> `Simplify` は本質的に「型を1段階フラット化して再評価する」処理を行うため、
> 広範囲に使うと `type &` と同様に **再帰的な型解決** が多発し、結果的にパフォーマンスを損なう可能性があります。

**推奨方針：**
- ✅ 局所的にのみ使用する（例：最終段階で API の戻り値を整形するときなど）
- 🚫 ネストされた大量の Props や中間層の型に対して一律に使わない
- 🧩 「開発体験のための一時展開」として限定的に活用する

```ts
// ✅ 良い例：最終的に出力する型をわかりやすくするために展開
type FinalProps = Simplify<HugeProps>;

// 🚫 悪い例：すべての中間型を毎回展開（構造爆発の原因）
type DeeplyExpanded = Simplify<ComponentProps & ContextProps & ConfigProps>;
```

## 10. トラブルシュート

### ⚠️ よくあるエラーと対処法

---

#### 🧩 `TS1259: can only be default-imported using esModuleInterop`

このエラーは、`React` のデフォルトインポートが許可されていない場合に発生します。
以下の設定を `tsconfig.base.json` に追加してください。

```json
{
  "compilerOptions": {
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  }
}
```
または、インポート文を次のように修正します：
```ts
import * as React from "react";
```
#### ⚙️ `MODULE_TYPELESS_PACKAGE_JSON`（ts-node 実行時の警告）

この警告は、`package.json` に `"type"` フィールドが指定されていない場合に発生します。
実行には影響しないため、**無視して問題ありません**

もし警告を抑制したい場合は、以下のように追記してください。

```json
{
  "type": "module"
}
```

> 💡 このデモは CommonJS 構成（デフォルト設定）でも正常に動作します。
> そのため、特別な設定変更は不要です。

---

#### 📈 計測結果にばらつきがある

型検査時間（`Check time`）やメモリ使用量には、実行ごとに多少のブレが発生します。
より安定した比較を行うためには、以下の手順を推奨します。

1. **同一 Node.js バージョン**で実行する
2. 各ケースを **2〜3 回** 計測し、**平均または中央値**を採用する
3. **初回実行結果**はウォームアップとして除外する（キャッシュ影響を避けるため）
4. 計測前に `rm -rf ./dist` や OS キャッシュクリアを行い、常にクリーンな状態で実行する

> ⏱️ 参考：TypeScript の `Check time` は純粋な型解析時間を、
> `/usr/bin/time` の `real` は実際のビルド体感時間を示します。
> 両者を併用すると、開発者体験と CI 実行性能の両面で差を可視化できます。

---

## 11. ライセンス

本プロジェクトは **MIT License** のもとで提供されています。
詳細は `LICENSE` ファイルを参照してください。

---

## 12. 付記（実プロジェクトでの応用）

このデモは **TypeScript の型システム性能を純粋に比較**するために設計されています。
Next.js や Webpack などのビルド要素を排除し、`tsc` 単体での型検査コストを明示的に計測します。

実際の開発現場で応用する場合は、以下の観測項目を追加するとより実践的です。

| 観測対象 | 内容 |
|-----------|------|
| **VSCode の補完レスポンス** | `type` と `interface` でのホバー・補完応答速度を比較 |
| **TypeScript Server Log** | コマンドパレット → “TypeScript: Open TS Server log” で処理時間を確認 |
| **CI/CD 実行時間** | `tsc --noEmit` を CI に組み込み、型検査パフォーマンスを継続監視 |

これらのデータを併せて分析することで、以下の判断が明確になります。

- なぜ大規模コードベースで `type &` がボトルネックになるのか
- `interface` ベース設計に移行した際の実際の時間短縮効果
- どの範囲で `Simplify<T>` などの補助型を適用すべきか

---

## 13. まとめ

- **`type` 交差型（`&`）は即時評価（Eager Evaluation）**
  → 構造が複雑になると **指数的に遅延**
- **`interface` 継承（`extends`）は遅延評価（Lazy Evaluation）**
  → 大規模な型でも **スケーラブルで安定**
- 実務では、**Props やオブジェクト構造を持つ型は `interface` に統一**
- **`Simplify<T>` は限定的に使用**し、開発体験と性能を両立させる

---

> 🧠 **結論**
> - 「可読性のために `type` を使う」よりも、「性能を考慮して `interface` を基準に設計する」方が最適。
> - 特に React や大型のドメインモデルを扱う場合、
>   `interface` 化により **補完速度・CI 型検査時間・エディタ応答性** が大幅に改善される。
```
