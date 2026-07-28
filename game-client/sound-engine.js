/**
 * 月下ノ影 — 生成アンビエント音エンジン
 *
 * 音源ファイルを一切使わず、Web Audio APIだけでその場合成する。
 * window.gekkaSound に API を集約し、グローバル汚染を避ける。
 * ES module不使用。単一 <script src="sound-engine.js"></script> で読み込む前提。
 */
(function (window) {
  'use strict';

  // ---------------------------------------------------------------------
  // 決定論的疑似乱数(Math.random禁止)
  // 仕様どおりの式をそのまま使う。seed は「seed % 1」で小数部だけが効くため、
  // 呼び出し側では意図的に小数を持つ値(カウンタ*係数、レイヤー番号*係数 等)を渡す。
  // ---------------------------------------------------------------------
  function seededUnit(seed, salt) {
    var v = Math.sin((Math.abs(seed % 1) + salt) * 12989.8) * 43758.5453;
    return Math.abs(v - Math.trunc(v));
  }

  // ---------------------------------------------------------------------
  // リバーブ用インパルスレスポンス(コード生成、外部ファイル不要)
  // ---------------------------------------------------------------------
  function createReverbImpulse(ctx, duration, decay) {
    var length = ctx.sampleRate * duration;
    var impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var data = impulse.getChannelData(ch);
      var noise = 0.37 + ch * 0.19;
      for (var i = 0; i < length; i++) {
        noise = (noise * 3.987654321) % 1;
        data[i] = (noise * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  // ---------------------------------------------------------------------
  // 音律定義: B2 D3 E3 F#3 A3 (基準ペンタトニック) + 上オクターブ B3 D4 E4
  // 半音を含まない5音の同一集合を「空気(air)」ごとに異なる帯域/部分集合で使う。
  // どの2音が重なっても構成音が同じなので不協和が発生しない。
  // ---------------------------------------------------------------------
  var NOTE = {
    B2: 123.471,
    D3: 146.832,
    E3: 164.814,
    Fs3: 184.997,
    A3: 220,
    B3: 246.942,
    D4: 293.664,
    E4: 329.628
  };

  // 「空気」4段。ドローン本体はD3/A3/E4固定(仕様どおり)。ここではフィルタの
  // 明るさとシマー(高域の短音)に使う音集合/密度だけを段ごとに変える。
  var AIR_STAGES = {
    inward: {
      filterBase: 340,
      shimmerEnabled: false,
      shimmerPool: []
    },
    calm: {
      filterBase: 820,
      shimmerEnabled: true,
      shimmerPool: [NOTE.B2, NOTE.D3, NOTE.E3, NOTE.Fs3, NOTE.A3]
    },
    open: {
      filterBase: 1450,
      shimmerEnabled: true,
      shimmerPool: [NOTE.D3, NOTE.E3, NOTE.Fs3, NOTE.A3, NOTE.B3, NOTE.D4]
    },
    radiant: {
      filterBase: 2300,
      shimmerEnabled: true,
      shimmerPool: [NOTE.Fs3, NOTE.A3, NOTE.B3, NOTE.D4, NOTE.E4]
    }
  };

  // フェーズ→空気/シマー密度/鼓動のマッピング(人狼の情動設計)
  var PHASE_CONFIG = {
    role_reveal: { air: 'calm', ambientLevelMul: 0.55, shimmer: false, shimmerMin: 8, shimmerMax: 16, heartbeat: false },
    night: { air: 'inward', ambientLevelMul: 1.0, shimmer: false, shimmerMin: 0, shimmerMax: 0, heartbeat: false },
    day: { air: 'open', ambientLevelMul: 1.0, shimmer: true, shimmerMin: 5, shimmerMax: 13, heartbeat: false },
    vote: { air: 'open', ambientLevelMul: 1.05, shimmer: true, shimmerMin: 2.5, shimmerMax: 6.5, heartbeat: true },
    finished: { air: null, ambientLevelMul: 0, shimmer: false, shimmerMin: 0, shimmerMax: 0, heartbeat: false }
  };

  var STORAGE_KEY = 'gekka-sound-muted';

  function loadMutedPref() {
    try {
      var v = window.localStorage.getItem(STORAGE_KEY);
      if (v === null) return true; // 既定はミュートON
      return v === 'true';
    } catch (e) {
      return true;
    }
  }

  function saveMutedPref(v) {
    try {
      window.localStorage.setItem(STORAGE_KEY, v ? 'true' : 'false');
    } catch (e) {
      /* localStorage不可でも無視 */
    }
  }

  // ---------------------------------------------------------------------
  // モジュール内部状態
  // ---------------------------------------------------------------------
  var ctx = null;
  var ready = false;
  var muted = loadMutedPref();

  var ambientGain, effectGain, reverbBus, convolver, compressor, masterGain;

  var currentPhase = null;
  var currentAirStageName = 'calm';

  var droneNodes = null; // [{osc, gain, layer}]
  var droneFilter = null;
  var droneLfoTimer = null;

  var shimmerTimer = null;
  var shimmerCounter = 0;

  var heartbeatTimer = null;

  // ---------------------------------------------------------------------
  // バス構成
  // ambientGain(0.26) / effectGain(0.27) / reverbBus(0.3→Convolver)
  //   → DynamicsCompressor(threshold -18dB, ratio 3) → masterGain(0.62) → destination
  // ambient/effectはドライ経路とリバーブ送り(センド)の両方に接続する。
  // ---------------------------------------------------------------------
  function setupGraph() {
    ambientGain = ctx.createGain();
    ambientGain.gain.value = 0.26;

    effectGain = ctx.createGain();
    effectGain.gain.value = 0.27;

    reverbBus = ctx.createGain();
    reverbBus.gain.value = 0.3;

    convolver = ctx.createConvolver();
    convolver.buffer = createReverbImpulse(ctx, 3.8, 2.3);

    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 3;

    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0.0001 : 0.62;

    ambientGain.connect(compressor);
    effectGain.connect(compressor);

    ambientGain.connect(reverbBus);
    effectGain.connect(reverbBus);
    reverbBus.connect(convolver);
    convolver.connect(compressor);

    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);
  }

  // ---------------------------------------------------------------------
  // 汎用の単発トーン(シマー、上昇音、和音、解決和音などで共用)
  // ゲインは exponentialRamp のため 0 ではなく 0.0001 を下限にする。
  // ---------------------------------------------------------------------
  function playTone(freq, when, dur, opts) {
    if (!ready) return;
    opts = opts || {};
    var type = opts.type || 'sine';
    var peakGain = Math.max(opts.gain != null ? opts.gain : 0.03, 0.0001);
    var attack = opts.attack != null ? opts.attack : 0.08;
    var release = opts.release != null ? opts.release : 1.2;
    var bus = opts.bus || effectGain;

    var osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;

    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peakGain, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + attack + dur + release);

    if (opts.filterFreq) {
      var filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = opts.filterFreq;
      osc.connect(filt);
      filt.connect(g);
    } else {
      osc.connect(g);
    }
    g.connect(bus);

    osc.start(when);
    osc.stop(when + attack + dur + release + 0.15);
  }

  // ---------------------------------------------------------------------
  // 鐘の音色: 非整数倍音 [1, 2.004, 2.76, 4.07]。高い倍音ほどattack遅く、
  // release短くすることで硬質な打撃音を作る。
  // ---------------------------------------------------------------------
  function playBell(freq, when, velocity) {
    if (!ready) return;
    velocity = velocity != null ? velocity : 1;
    var partials = [1, 2.004, 2.76, 4.07];
    var gains = [0.055, 0.024, 0.014, 0.007];
    var attacks = [0.006, 0.015, 0.03, 0.05];
    var releases = [1.8, 1.2, 0.7, 0.4];

    for (var i = 0; i < partials.length; i++) {
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * partials[i];

      var peak = Math.max(gains[i] * velocity, 0.0001);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(peak, when + attacks[i]);
      g.gain.exponentialRampToValueAtTime(0.0001, when + attacks[i] + releases[i]);

      osc.connect(g);
      g.connect(effectGain);
      osc.start(when);
      osc.stop(when + attacks[i] + releases[i] + 0.15);
    }
  }

  // ---------------------------------------------------------------------
  // ドローン: triangle1本(D3) + sine2本(A3, E4)。
  // フィルタ周波数・デチューン・各層ゲインを素数周期のsin LFOで揺らし、
  // パターンが永久に一致しないようにする。4秒毎に更新。
  // ---------------------------------------------------------------------
  var DRONE_LAYERS = [
    { freq: NOTE.D3, type: 'triangle', baseGain: 0.03, detunePeriod: 71, gainPeriod: 109, seed: 0.37 },
    { freq: NOTE.A3, type: 'sine', baseGain: 0.035, detunePeriod: 83, gainPeriod: 113, seed: 0.61 },
    { freq: NOTE.E4, type: 'sine', baseGain: 0.018, detunePeriod: 97, gainPeriod: 137, seed: 0.84 }
  ];
  var FILTER_LFO_PERIOD = 53;

  function startDrone() {
    var stage = AIR_STAGES[currentAirStageName] || AIR_STAGES.calm;

    droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = stage.filterBase;
    droneFilter.Q.value = 0.7;
    droneFilter.connect(ambientGain);

    droneNodes = DRONE_LAYERS.map(function (layer) {
      var osc = ctx.createOscillator();
      osc.type = layer.type;
      osc.frequency.value = layer.freq;

      var g = ctx.createGain();
      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(Math.max(layer.baseGain, 0.0001), ctx.currentTime + 3);

      osc.connect(g);
      g.connect(droneFilter);
      osc.start();

      return { osc: osc, gain: g, layer: layer };
    });

    if (droneLfoTimer) clearInterval(droneLfoTimer);
    droneLfoTimer = setInterval(updateDroneLfo, 4000);
    updateDroneLfo();
  }

  function updateDroneLfo() {
    if (!droneNodes || !droneFilter) return;
    var t = ctx.currentTime;
    var next = t + 4.2;
    var stage = AIR_STAGES[currentAirStageName] || AIR_STAGES.calm;

    // フィルタカットオフ(53秒周期)。空気段の基準値を中心に±35%揺らす。
    var filterPhase = seededUnit(0.19, 0.31) * Math.PI * 2;
    var filterLfo = Math.sin((t / FILTER_LFO_PERIOD) * Math.PI * 2 + filterPhase);
    var filterTarget = Math.max(80, stage.filterBase * (1 + filterLfo * 0.35));
    droneFilter.frequency.cancelScheduledValues(t);
    droneFilter.frequency.setValueAtTime(droneFilter.frequency.value, t);
    droneFilter.frequency.linearRampToValueAtTime(filterTarget, next);

    droneNodes.forEach(function (node, idx) {
      var layer = node.layer;
      var phaseOff = seededUnit(layer.seed, idx * 0.17 + 0.5) * Math.PI * 2;

      var gainLfo = Math.sin((t / layer.gainPeriod) * Math.PI * 2 + phaseOff);
      var gainTarget = Math.max(layer.baseGain * (0.7 + gainLfo * 0.3), 0.0001);

      var detuneLfo = Math.sin((t / layer.detunePeriod) * Math.PI * 2 + phaseOff * 1.3);
      var detuneTarget = detuneLfo * 8; // ±8セント

      node.gain.gain.cancelScheduledValues(t);
      node.gain.gain.setValueAtTime(Math.max(node.gain.gain.value, 0.0001), t);
      node.gain.gain.linearRampToValueAtTime(gainTarget, next);

      node.osc.detune.cancelScheduledValues(t);
      node.osc.detune.setValueAtTime(node.osc.detune.value, t);
      node.osc.detune.linearRampToValueAtTime(detuneTarget, next);
    });
  }

  function stopDrone(fadeSec) {
    if (droneLfoTimer) {
      clearInterval(droneLfoTimer);
      droneLfoTimer = null;
    }
    if (!droneNodes) return;
    var t = ctx.currentTime;
    var nodesToStop = droneNodes;
    var filterToRelease = droneFilter;

    nodesToStop.forEach(function (node) {
      node.gain.gain.cancelScheduledValues(t);
      node.gain.gain.setValueAtTime(Math.max(node.gain.gain.value, 0.0001), t);
      node.gain.gain.exponentialRampToValueAtTime(0.0001, t + fadeSec);
      node.osc.stop(t + fadeSec + 0.2);
    });

    droneNodes = null;
    droneFilter = null;

    setTimeout(function () {
      if (filterToRelease) {
        try {
          filterToRelease.disconnect();
        } catch (e) {
          /* 既に切断済みでも無視 */
        }
      }
    }, (fadeSec + 0.5) * 1000);
  }

  // 空気(air)段の切り替え。setPhaseからの明示遷移は演出なので即座(短いクロス
  // フェードのみ)。45秒最小滞在/1段階ずつのルールは、ここでは将来の自律ドリフト
  // 用の設計として温存し、明示フェーズ切替では適用しない。
  function applyAirStage(name, rampSec) {
    currentAirStageName = name;
    if (!droneFilter) return;
    var stage = AIR_STAGES[name];
    var t = ctx.currentTime;
    droneFilter.frequency.cancelScheduledValues(t);
    droneFilter.frequency.setValueAtTime(droneFilter.frequency.value, t);
    droneFilter.frequency.linearRampToValueAtTime(stage.filterBase, t + rampSec);
  }

  // ---------------------------------------------------------------------
  // シマー: 高域の短音。5〜13秒(vote時は2倍密度)に1回、ペンタトニックの
  // 現在の空気段の音集合から1音を選んで鳴らす。
  // ---------------------------------------------------------------------
  function scheduleShimmer(minSec, maxSec) {
    clearTimeout(shimmerTimer);
    shimmerCounter += 1;
    // 0.1刻みだと counter が10の倍数のとき seed%1 がほぼ0になり周期性が出るため、
    // 黄金比の端数を係数にして一様に散らす
    var jitter = seededUnit(shimmerCounter * 0.6180339887, 0.42);
    var wait = (minSec + jitter * (maxSec - minSec)) * 1000;
    shimmerTimer = setTimeout(function () {
      playShimmerNote();
      scheduleShimmer(minSec, maxSec);
    }, wait);
  }

  function stopShimmer() {
    clearTimeout(shimmerTimer);
    shimmerTimer = null;
  }

  function playShimmerNote() {
    var stage = AIR_STAGES[currentAirStageName] || AIR_STAGES.calm;
    var pool = stage.shimmerPool;
    if (!stage.shimmerEnabled || !pool || !pool.length) return;
    var pick = seededUnit(shimmerCounter * 0.6180339887, 0.85);
    var freq = pool[Math.floor(pick * pool.length) % pool.length];
    playTone(freq, ctx.currentTime + 0.02, 0.6, {
      type: 'sine',
      gain: 0.028,
      attack: 0.15,
      release: 2.2,
      filterFreq: 3200
    });
  }

  // ---------------------------------------------------------------------
  // 鼓動(vote専用): 88BPMの4分音符で低いsine拍動。緊張の演出。
  // ---------------------------------------------------------------------
  function startHeartbeat() {
    stopHeartbeat();
    var beatInterval = 60 / 88; // 秒
    var nextBeat = ctx.currentTime + 0.1;

    function tick() {
      // バックグラウンドのタイマー間引きで nextBeat が現在時刻より過去に
      // 取り残されると、復帰時に catch-up ループで拍が束になって鳴る。
      // 追いかけずに現在時刻へリセットして取りこぼしは捨てる。
      if (nextBeat < ctx.currentTime) nextBeat = ctx.currentTime + 0.1;
      playHeartbeatPulse(nextBeat);
      nextBeat += beatInterval;
      var delay = (nextBeat - ctx.currentTime - 0.05) * 1000;
      heartbeatTimer = setTimeout(tick, Math.max(10, delay));
    }
    tick();
  }

  function stopHeartbeat() {
    clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
  }

  function playHeartbeatPulse(when) {
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = NOTE.B2 * 0.5;

    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.02, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);

    osc.connect(g);
    g.connect(effectGain);
    osc.start(when);
    osc.stop(when + 0.3);
  }

  // ---------------------------------------------------------------------
  // finished: ドローン停止 → ゆっくり解決和音(4音, attack 400ms, release 7秒)
  // ---------------------------------------------------------------------
  function playResolveChord() {
    var t = ctx.currentTime + 0.05;
    var notes = [NOTE.D3, NOTE.A3, NOTE.B3, NOTE.E4];
    notes.forEach(function (freq) {
      playTone(freq, t, 0.2, {
        type: 'sine',
        gain: 0.03,
        attack: 0.4,
        release: 7,
        filterFreq: 2600,
        bus: ambientGain
      });
    });
  }

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------
  function init() {
    if (ready) {
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return; // Web Audio非対応環境ではno-op

    ctx = new AC();
    // iOS対策: ユーザー操作のコールスタック内(このinit呼び出し)でresume()する。
    ctx.resume();

    setupGraph();
    ready = true;

    setPhase('role_reveal');
  }

  function setPhase(phaseName) {
    if (!ready) return; // 未initならno-op
    var config = PHASE_CONFIG[phaseName];
    if (!config) return;

    currentPhase = phaseName;

    if (phaseName === 'finished') {
      stopShimmer();
      stopHeartbeat();
      stopDrone(2.5);
      playResolveChord();
      return;
    }

    var isFirstStart = !droneNodes;
    currentAirStageName = config.air;
    if (isFirstStart) {
      startDrone();
    } else {
      applyAirStage(config.air, 2.5);
    }

    var ambientTarget = 0.26 * config.ambientLevelMul;
    var t = ctx.currentTime;
    ambientGain.gain.cancelScheduledValues(t);
    ambientGain.gain.setValueAtTime(Math.max(ambientGain.gain.value, 0.0001), t);
    ambientGain.gain.linearRampToValueAtTime(Math.max(ambientTarget, 0.0001), t + 2.5);

    if (config.shimmer) {
      scheduleShimmer(config.shimmerMin, config.shimmerMax);
    } else {
      stopShimmer();
    }

    if (config.heartbeat) {
      startHeartbeat();
    } else {
      stopHeartbeat();
    }
  }

  function stinger(name) {
    if (!ready) return;
    var t = ctx.currentTime;

    switch (name) {
      case 'attack':
        // 襲撃 = 低い鐘、一打
        playBell(NOTE.B2 * 0.5, t + 0.02, 1.0);
        break;

      case 'execution':
        // 処刑 = 鐘2打
        playBell(NOTE.D3 * 0.5, t + 0.02, 1.0);
        playBell(NOTE.B2 * 0.5, t + 0.95, 0.85);
        break;

      case 'reveal':
        // 役職公開 = 上昇2音
        playTone(NOTE.D3, t + 0.02, 0.18, { type: 'triangle', gain: 0.05, attack: 0.02, release: 0.6, filterFreq: 2600 });
        playTone(NOTE.A3, t + 0.28, 0.22, { type: 'triangle', gain: 0.055, attack: 0.015, release: 0.9, filterFreq: 3200 });
        break;

      case 'victory_wolf':
        // 暗い和音(低域・遅いattack)
        [NOTE.B2, NOTE.D3, NOTE.E3].forEach(function (freq) {
          playTone(freq, t + 0.02, 1.2, { type: 'sine', gain: 0.045, attack: 0.5, release: 3.2, filterFreq: 700 });
        });
        break;

      case 'victory_citizen':
        // 明るい和音(radiantの音・速いattack)
        [NOTE.A3, NOTE.B3, NOTE.D4, NOTE.E4].forEach(function (freq, i) {
          playTone(freq, t + 0.02 + i * 0.05, 1.4, { type: 'sine', gain: 0.04, attack: 0.08, release: 3.6, filterFreq: 4200 });
        });
        break;

      default:
        break;
    }
  }

  function setMuted(bool) {
    muted = !!bool;
    saveMutedPref(muted);
    if (!ready) return;

    var t = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.setValueAtTime(Math.max(masterGain.gain.value, 0.0001), t);
    if (muted) {
      masterGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      // 無音化だけでなく発振器とタイマーも止める(モバイルのバッテリ対策)。
      // フェードが終わってから停止する
      stopShimmer();
      stopHeartbeat();
      stopDrone(0.6);
    } else {
      // ミュート解除時はmasterを0→0.62へ2.8秒ランプし、現在フェーズの空気を復帰
      masterGain.gain.exponentialRampToValueAtTime(0.62, t + 2.8);
      if (currentPhase && currentPhase !== 'finished') setPhase(currentPhase);
    }
  }

  function isMuted() {
    return muted;
  }

  function isReady() {
    return ready;
  }

  window.gekkaSound = {
    init: init,
    setPhase: setPhase,
    stinger: stinger,
    setMuted: setMuted,
    isMuted: isMuted,
    isReady: isReady
  };
})(window);
