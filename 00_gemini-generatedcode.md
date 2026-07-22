SCAVENGERS UI/UX Design System & Mobile UI SpecificationVersion: 1.0.0Target: Mobile Web App (React + Tailwind CSS)Theme: Post-Apocalyptic Dark Fantasy (Retro-Futuristic Medieval)System Role: Principal Product Designer & Design Systems Lead1. Design Principles & Practical Decisions『SCAVENGERS』のUI/UXは、単なる「雰囲気作りのファンタジー装飾」ではなく、極限のサスペンスとプレイヤー間の対面コミュニケーションを阻害しない「実用的な端末インターフェース（旧世界の遺物）」として設計されます。+-------------------------------------------------------------+
|                         RITUAL                              |
|   Clear, slow, cinematic phases that elevate tension.        |
+-------------------------------------------------------------+
|                         LEGIBILITY                          |
|   High-contrast, bold typography. 12px min. No micro-text.  |
+-------------------------------------------------------------+
|                         SECRECY                             |
|   Zero external clues. Same night glow, vibes, and timings. |
+-------------------------------------------------------------+
|                      RECOVERABILITY                         |
|   Safe states. Auto-merge phase after crash/disconnect.    |
+-------------------------------------------------------------+
|                         RESTRAINT                           |
|   Illustrations are king. UI stays dark, flat, & skeletal.  |
+-------------------------------------------------------------+
1.1. Ritual (儀式性)判断例: 夜フェーズへの移行時、画面は瞬時に暗転するのではなく、旧世界のグリッチノイズ（0.3秒）ののち、ゆっくりと「消灯（一斉スリープ状態）」するように暗くなります。投票結果の公開時には、全員の端末が「同調（シンクロ）」して1秒間ロックされ、同時に名前が暴かれます。1.2. Legibility (可読性)判断例: 暗い部屋や屋外、心理的緊張下でも一瞬で認知できるよう、文字サイズは基本14px以上、重要情報は32px以上のTabular Numeral（等幅数字）を使用します。背景色（Soot #0B0B0C）とプレーンテキスト（Ash #E1E1E6）のコントラスト比は WCAG AAA (7.5:1以上) を常時確保します。1.3. Secrecy (秘密保持の徹底)判断例: 人狼陣営だからといって、スマートフォンのバックライトが赤く光ったり、バイブレーションが「ドクンドクン」と震えたりすることは絶対にありません。夜フェーズ中の全プレイヤーの画面の「平均輝度（Mean Brightness）」および「放射光スペクトル（Color Temperature）」は完全に同一に保たれます。人狼の襲撃操作画面と、市民の待機画面は、骨格レベルで同じグリッドと暗さ（Soot/Charcoal）を共有します。1.4. Recoverability (復旧性)判断例: 電波状況の悪い対面環境を想定し、通信が切れた際は全画面上部に「記録網への再接続中...（オフライン保護レイヤー）」をオーバーレイ表示します。復帰時は直前の未送信アクションを自動的に再試行し、現在のサーバーフェーズへ遅延なく同期します。戻るボタンでの意図しないロビー退出はブラウザの「BeforeUnload」APIで厳重にブロックします。1.5. Restraint (抑制美)判断例: 緻密に描かれたカードイラストを主役にするため、通常のボタンやリスト、ヘッダーに「中世のファンタジー枠線」や「過剰なギザギザ」を多用しません。UIは徹底的にフラットで直線的、細いワイヤーフレーム（旧世界の鉄骨構造をイメージ）で構築し、イラストが現れる瞬間（Privacy Reveal時）だけがリッチに彩られます。2. Token ArchitectureFigma Variables、Tailwind CSS、およびJSONスキーマに直接エクスポート可能な3層構造（Primitive, Semantic, Component）のトークン設計です。{
  "prefix": "scv",
  "modes": {
    "public": "Public information context (Day / Lobby)",
    "private": "Private information context (Night / Role Reveal)",
    "concealed": "Privacy cover overlay state"
  }
}
2.1. Color Tokens (Tailwind CSS Extended Configuration)// tailwind.config.js - Custom Theme Extensions
module.exports = {
  theme: {
    extend: {
      colors: {
        scv: {
          // Primitive Colors (Neutrals & Factions)
          soot: '#0B0B0C',       // 漆黒（極小の有機物の炭色）- 基本背景
          charcoal: '#1A1A1C',   // 炭色 - コンポーネント表面
          ash: '#E1E1E6',        // 灰白色 - 主要文字（高コントラスト）
          paper: '#D0C9BC',      // 古紙色 - 昼フェーズセピア背景用
          silver: '#8A8D93',     // 酸化銀色 - 補助テキスト、ボーダー
          
          // Phase Colors (Semantic Overlays)
          day: {
            bg: '#ECE9E2',       // 昼：完全に明るい紙の質感
            text: '#1F1F21',
            accent: '#4A5D4E'    // くすんだオリーブ（市民活動期）
          },
          night: {
            bg: '#060607',       // 夜：完全な闇
            text: '#8F9196',
            accent: '#343840'    // インダストリアルグレー（記録網制御期）
          },

          // Faction Accents (Only used in PRIVATE/REVEAL context!)
          faction: {
            citizen: '#4D6B54',  // 市民陣営：煤けたオリーブグリーン
            werewolf: '#962D2D', // 人狼陣営：錆びた血の赤
            third: '#89409E',    // 第三陣営（狂信者など）：旧世界の毒紫色
          },

          // Semantic States
          success: '#2E7D32',
          warning: '#EF6C00',
          danger: '#C62828',
          info: '#1565C0',
          offline: '#3E2723',    // 錆鉄のような焦茶色の警告
          reconnecting: '#FFB300'
        }
      }
    }
  }
}
2.2. Typography (Type Scale & Weights)可読性と旧世界端末としての無機質さを両立するため、日本語本文には「システムゴシック（シャープにレンダリングされるボールド）」、数字・タイマーには「等幅サンセリフ（Tabular Numerals）」を強制指定します。TokenTarget ElementFont FamilySize (px/rem)Line HeightLetter Spacingscv-font-display儀式・役職公開・勝敗Georgia, "YuMincho", serif36px (2.25rem)1.2-0.02emscv-font-headingフェーズタイトル・警告System-UI, sans-serif (Heavy)20px (1.25rem)1.40.05emscv-font-bodyルール・対話ログ・GM指示System-UI, sans-serif15px (0.9375rem)1.60.02emscv-font-labelプレイヤー名・ボタンSystem-UI, sans-serif (Medium)14px (0.875rem)1.20.04emscv-font-timer残り時間タイマーmonospace (Tabular)48px (3.0rem)1.00.00emscv-font-codeルームコード（6桁）monospace (Tabular)24px (1.5rem)1.00.15em3. Layout, Shape, and Motion Specs3.1. Mobile Grid & Touch TargetsSpacing Base: 4px 単位のスケール (size-1 = 4px, size-2 = 8px, size-4 = 16px, size-6 = 24px)。Fluid Breakpoints: 縦長画面を完全保証。Compact: 360px (Web viewports down to 800px height)Standard: 390px (iPhone 13-15 base)Large: 430px (Pro Max base)Touch Targets: 全てのインタラクティブ・ターゲット（ボタン、リスト、トグル）は、最低でも 48px × 48px の領域を物理的に確保。リスト幅いっぱいのプレイヤー行タップ領域は 56px 高さを最小値とします。3.2. Surface & Borders (旧世界のテクスチャ表現)Radius (角丸): 基本 0px（鋭角のインダストリアル感）または 4px（旧端末のベゼルを模倣）。装飾的な大きい角丸は原則禁止。Borders: 境界線は border-1px または border-2px を使用し、色は scv-silver または scv-charcoal で「鉄筋構造」のように構築します。Texture Overlays:/* 画面全体、またはカード背後にのみ敷かれる、旧世界の錆び・走査線エフェクト */
.scv-scanline-overlay {
  background: linear-gradient(
    rgba(18, 16, 16, 0) 50%, 
    rgba(0, 0, 0, 0.25) 50%
  ), linear-gradient(
    90deg, 
    rgba(255, 0, 0, 0.06), 
    rgba(0, 255, 0, 0.02), 
    rgba(0, 0, 255, 0.06)
  );
  background-size: 100% 4px, 6px 100%;
}
3.3. Motion Spectrum & Reduced MotionInstant Feedback (0.05s / ease-out): ボタンタップ時の押し込み感、状態切り替え。Micro Transition (0.15s / ease-in-out): リストアイテムの選択、エラーポップアップ。Phase Transition (0.4s / cubic-bezier(0.4, 0, 0.2, 1)): 昼から夜、夜から朝への切り替え。Cinematic Reveal (1.2s / ease-out): カードを指でホールドした際、徐々にイラストが浮かび上がる演出。/* Acccessibility / prefers-reduced-motion fallback */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
4. Privacy Context Matrix『SCAVENGERS』における最も重要なUX設計要件：「周囲の視線から情報を防衛する」ための3つのコンテキストマトリクス。Screen StateApplied ContextVisual RulesInteraction ConstraintLobby, Day DiscussionPublic背景は明るい「紙色 (scv-paper)」または無機質な「炭色 (scv-charcoal)」。役職色は表示しない。タップ、スクロール、通常のボタン操作。Night Action PhasePrivate背景は「漆黒 (scv-soot)」。人狼・占い師などの行動選択時も、輝度は極めて低く保つ。選択肢を1タップで即確定させず、必ず「タップ選択 → 確定スライド」の2段階。Hold-To-Reveal CardConcealed通常時はノイズまたは鉄扉の画像でカード全体をブラインド。指で長押ししている間だけ、役職が露出。onMouseDown / onTouchStart でアクティブ化。指を離した（onTouchEnd）瞬間、0.05秒で瞬時に非表示に復帰。5. UI Component Specifications & React Implementation以下は、デザインシステムに沿って実装された、再利用可能でアクセシブルな主要Reactコンポーネントの実装コードです。5.1. AppShell & SafeAreaFrame (共通骨格)import React from 'react';

interface AppShellProps {
  children: React.ReactNode;
  phase: 'day' | 'night' | 'reconnecting';
  isOffline?: boolean;
}

export const AppShell: React.FC<AppShellProps> = ({ children, phase, isOffline = false }) => {
  return (
    <div className={`
      relative w-full h-screen overflow-hidden select-none touch-none
      ${phase === 'day' ? 'bg-scv-day-bg text-scv-day-text' : 'bg-scv-soot text-scv-ash'}
    `}>
      {/* Scanline pattern for Old-world terminal feel */}
      <div className="absolute inset-0 pointer-events-none scv-scanline-overlay opacity-10 z-50" />

      {/* Connection Failure Banner */}
      {isOffline && (
        <div 
          role="alert" 
          aria-live="assertive"
          className="absolute top-0 inset-x-0 bg-scv-danger text-white py-2 text-center text-xs font-bold tracking-widest z-50 animate-pulse border-b border-scv-soot"
        >
          [ 記録網への再接続中... ]
        </div>
      )}

      {/* Main Content Area considering Safe Area (iOS Home Indicator) */}
      <main className="w-full h-full flex flex-col justify-between px-4 pt-10 pb-8 safe-area-bottom">
        {children}
      </main>
    </div>
  );
};
5.2. HoldToReveal (秘密情報を守る遮蔽と露出)import React, { useState, useRef } from 'react';

interface HoldToRevealProps {
  roleName: string;
  roleIllustrationUrl: string;
  factionColor: string;
  onRevealStart?: () => void;
  onRevealEnd?: () => void;
}

export const HoldToReveal: React.FC<HoldToRevealProps> = ({
  roleName,
  roleIllustrationUrl,
  factionColor,
  onRevealStart,
  onRevealEnd
}) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    onRevealStart?.();
    // 0.2秒のホールドで露出開始（誤操作防止）
    timerRef.current = setTimeout(() => {
      setIsRevealed(true);
    }, 200);
  };

  const handleEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setIsRevealed(false);
    onRevealEnd?.();
  };

  return (
    <div className="w-full max-w-xs mx-auto flex flex-col items-center">
      <div
        role="button"
        aria-grabbed={isRevealed}
        tabIndex={0}
        onMouseDown={handleStart}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchEnd={handleEnd}
        className={`
          relative w-64 h-96 border-2 border-scv-silver bg-scv-charcoal overflow-hidden cursor-pointer
          transition-transform duration-100 ease-out active:scale-95
          ${isRevealed ? 'ring-4 ring-offset-4 ring-offset-scv-soot' : 'ring-0'}
        `}
        style={{ '--ring-color': factionColor } as React.CSSProperties}
      >
        {isRevealed ? (
          /* Private Context (露出状態) */
          <div className="absolute inset-0 flex flex-col justify-between p-4 animate-fade-in">
            <div className="absolute inset-0 bg-cover bg-center opacity-50 filter grayscale" style={{ backgroundImage: `url(${roleIllustrationUrl})` }} />
            <div className="relative z-10 flex flex-col h-full justify-between">
              <span className="text-xs uppercase tracking-widest text-scv-silver">[ 機密記録 ]</span>
              <div className="flex flex-col items-start">
                <span className="text-3xl font-bold tracking-wider" style={{ color: factionColor }}>{roleName}</span>
                <span className="text-xs mt-1 text-scv-silver">周囲の視線に注意してください。</span>
              </div>
            </div>
          </div>
        ) : (
          /* Concealed Context (遮蔽状態) */
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center select-none">
            {/* Minimal SVG Padlock Symbol */}
            <svg className="w-12 h-12 text-scv-silver opacity-60 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-md font-bold tracking-widest text-scv-ash">[ 画面を長押し ]</span>
            <p className="text-xs text-scv-silver mt-2 leading-relaxed">
              指を置いている間だけ、<br />割り当てられた役職が表示されます。
            </p>
          </div>
        )}
      </div>
      <span className="text-[11px] text-scv-silver mt-4 uppercase tracking-widest">
        {isRevealed ? "!! SECRET REVEALED !!" : "Hold to decypher record"}
      </span>
    </div>
  );
};
5.3. VoteBallot (対面で迷わないセキュアな投票)import React, { useState } from 'react';

interface Player {
  id: string;
  name: string;
  isDead: boolean;
}

interface VoteBallotProps {
  players: Player[];
  myId: string;
  onSubmitVote: (targetId: string) => void;
}

export const VoteBallot: React.FC<VoteBallotProps> = ({ players, myId, onSubmitVote }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const handleSelect = (id: string) => {
    if (isConfirmed) return;
    setSelectedId(id === selectedId ? null : id);
  };

  const handleConfirm = () => {
    if (selectedId) {
      setIsConfirmed(true);
      onSubmitVote(selectedId);
    }
  };

  return (
    <div className="w-full flex flex-col justify-between h-full max-w-md mx-auto">
      <div>
        <h2 className="text-sm font-bold tracking-widest text-center text-scv-silver uppercase mb-4">
          [ 裁定：排除対象の選択 ]
        </h2>
        
        {/* Player List Grid */}
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {players.map((player) => {
            const isMe = player.id === myId;
            const isDisabled = player.isDead || isMe || isConfirmed;
            const isSelected = selectedId === player.id;

            return (
              <button
                key={player.id}
                disabled={isDisabled}
                onClick={() => handleSelect(player.id)}
                className={`
                  w-full px-4 py-3 flex justify-between items-center text-left border transition-all duration-100
                  ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'active:bg-scv-charcoal'}
                  ${isSelected 
                    ? 'border-scv-ash bg-scv-charcoal text-white' 
                    : 'border-scv-charcoal text-scv-silver bg-transparent'}
                `}
              >
                <span className="font-medium tracking-wide">{player.name} {isMe && "(あなた)"}</span>
                {player.isDead ? (
                  <span className="text-xs uppercase text-scv-danger tracking-widest">[ 排除完了 ]</span>
                ) : isSelected ? (
                  <span className="text-xs uppercase text-scv-ash tracking-widest animate-pulse">[ 選択中 ]</span>
                ) : (
                  <span className="text-xs text-scv-silver opacity-40">TARGETABLE</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Safe Two-Step Confirmation Area */}
      <div className="mt-6 border-t border-scv-charcoal pt-4">
        {selectedId ? (
          <div className="space-y-3">
            <p className="text-xs text-center text-scv-silver">
              対象: <strong className="text-scv-ash">{players.find(p => p.id === selectedId)?.name}</strong>
              <br />確定すると、このフェーズが終わるまで変更できません。
            </p>
            <button
              onClick={handleConfirm}
              disabled={isConfirmed}
              className={`
                w-full py-4 text-center font-bold tracking-widest uppercase border transition-all duration-200
                ${isConfirmed 
                  ? 'bg-scv-success/20 border-scv-success text-scv-success cursor-not-allowed' 
                  : 'bg-scv-ash text-scv-soot border-scv-ash hover:bg-white active:scale-98'}
              `}
            >
              {isConfirmed ? "✓ 意思表示を記録しました" : "排除の選択を確定する"}
            </button>
          </div>
        ) : (
          <div className="py-4 text-center text-xs text-scv-silver border border-dashed border-scv-charcoal">
            裁定を下す対象を選択してください。
          </div>
        )}
      </div>
    </div>
  );
};
6. Content Design & "The Recorder" PersonaAIゲームマスター（都市記録装置：『記録者（The Recorder）』）の発話メッセージ、およびシステムラベルは、旧世界のアナログシステムが機能的に出力するログを模し、常に平坦、客観的、そして短く構築されます。6.1. ライティング原則客観性の維持: プレイヤーの嘘や心理を煽る発言は一切不可。「あなたは本当に人間ですか？」のような情緒的ゆさぶりはシステム全体の無機質な美学を壊します。自己肯定・謙遜の排除: 「AIが判定しています」等のメタ発言、または「エラーが起きてごめんなさい」等の人格表現を排除します。簡潔な指令: モバイルの一画面に収まり、対面会話を妨げない文字数（最大30文字以内）に圧縮します。6.2. UIメッセージ辞書ScenarioRecommended CopyAvoid役職確認待ち「記録を確認してください。」「あなたの真の姿を見せてあげましょう…」夜の行動（対象選択）「対象を1人選んでください。」「今夜、誰の息の根を止めますか？」選択完了（同調待ち）「選択を記録しました。接続維持中。」「お見事。全員が完了するまでお待ちください。」昼の開始（犠牲者あり）「前夜、居住者1名との通信途絶。」「悲しいお知らせです。〇〇さんが惨殺されました。」接続不良の復旧中「通信復旧中。現在の状態を維持します。」「エラーが発生。ネット環境を調べて！」7. Accessibility Checklist (WCAG AA Strict Alignment)モバイル端末を使った対面対話という「薄暗い環境」「焦りや興奮」が予測されるコンテキストに対し、以下の基準を厳格に満たします。[ ] Contrast Verification: すべての昼画面・夜画面のテキストおよび主要シンボルは、背景色とのコントラスト比 4.5:1 (WCAG AA) 以上を満たしている（推奨はAAAの7.0:1以上）。[ ] Dual Coding State Check: オフライン、プレイヤー死亡、選択、完了などの重要状態は、色（赤や緑）だけで表現せず、必ず「[ OFF ]」「[ 排除済 ]」「✓」などのラベルまたは形状（アイコン）を同等に並記する。[ ] Strict Target Areas: ボタン、リスト行、および投票のチェックエリアは、すべて物理サイズ 48px 以上の高さ・幅を持ち、隣接ターゲットとのマージンを 4px 以上確保して誤タップを防ぐ。[ ] Dynamic Scaling & Flow: スマートフォンの文字サイズ設定で「200%」まで拡大された場合も、プレイヤー名が楕円の外へ崩れ落ちたり、決定ボタンが画面外へ見えなくなったりしないよう、flex-wrap と overflow-y-auto による流動（Fluid）レイアウトを使用する。[ ] Reduced Motion Support: アプリケーションシェルおよび画面切り替えのアニメーションは、prefers-reduced-motion: reduce をメディアクエリで検知した場合、フェード・移動アニメーションを無効化し、0s (Instant) で表示する。8. Implementation & Handoff Guidance for Developers8.1. State Architecture & Redundant Protection                                  [ Server Game Engine State ]
                                               │
                       WebSocket (Socket.io) / SSE Connection State
                                               │
       ┌───────────────────────────────┴───────────────────────────────┐
       ▼                                                               ▼
[ Public UI Phase Status ]                                    [ Private UI Input State ]
- Reset local inputs on Phase transition                      - Cache in Memory
- Always safe to redraw / force refresh                       - NEVER serialize to localStorage/URL!
秘密情報の生存期間（Memory Lifecycle）:RoleCard の露出状態、HoldToReveal 中のタップイベント、VoteBallot の選択ターゲットは、永続的ストレージ（localStorage, sessionStorage, URLSearchParams）に保存してはなりません。これらはメモリ内のReact State（useState）のみで完結させ、画面がリロードされた、またはブラウザから離脱した場合は、バックエンド（記録者システム）へ問い合わせて再認証したうえで、安全に再フェローシップを要求する設計にします。App Switcher & Background Defense:WebアプリがOSのバッググラウンドに移行した場合（マルチタスク画面で隣から画面スニッフィングされる危険を防ぐため）、visibilitychange イベントまたは window.onblur を検知した瞬間に、すべての HoldToReveal コンポーネントの状態を強制的に isRevealed = false（遮蔽状態）に差し戻します。8.2. CSS classes (Tailwind utility shortcuts)実装者が一貫性を保てるよう、以下のカスタムユーティリティクラスをコンポーネント実装のベースとします。class="scv-bg-soot": bg-[#0B0B0C] (夜)class="scv-bg-paper": bg-[#ECE9E2] (昼)class="scv-border-iron": border-[#8A8D93] border-1px (旧文明の金属枠)class="scv-text-tabular": font-mono tracking-tighter tabular-nums (数値・タイマー)