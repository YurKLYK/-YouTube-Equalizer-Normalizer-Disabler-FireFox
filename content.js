// Audio Context state
let audioCtx = null;
let sourceNode = null;
let preampNode = null;
let normalizerNode = null;
let limiterNode = null;
let filterNodes = [];
let currentVideoElement = null;

// EQ Configuration
const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const EQ_BANDS_LABELS = ['32Hz', '64Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz'];

// Multi-language Support
const I18N = {
    ja: {
        title: 'イコライザー',
        preamp: 'プリアンプ',
        low: '低音',
        mid: '中域',
        high: 'トレブル',
        normalizerOff: 'ノーマライザー無効化',
        normalizerOn: 'ノーマライザー',
        limiter: '音割れ防止 (Limiter)',
        reset: 'Reset',
        tooltip: 'イコライザー'
    },
    en: {
        title: 'Equalizer',
        preamp: 'Preamp',
        low: 'Low',
        mid: 'Mid',
        high: 'High',
        normalizerOff: 'Normalizer Disabled',
        normalizerOn: 'Normalizer',
        limiter: 'Limiter (Anti-clip)',
        reset: 'Reset',
        tooltip: 'Equalizer'
    }
};

const LANG = navigator.language.startsWith('ja') ? 'ja' : 'en';
const getMsg = (key) => I18N[LANG][key] || I18N['en'][key];

// Default Settings
const DEFAULT_SETTINGS = {
    preamp: 0,
    bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    enabled: true,
    normalizerEnabled: true,
    limiterEnabled: true
};

let eqSettings = { ...DEFAULT_SETTINGS };

function getPageWindow() {
    return window.wrappedJSObject || window;
}

function getUnwrappedElement(element) {
    if (!element) return null;
    return element.wrappedJSObject || element;
}

function getPlayerResponse(moviePlayer) {
    const unsafePlayer = getUnwrappedElement(moviePlayer);
    if (!unsafePlayer || typeof unsafePlayer.getPlayerResponse !== 'function') {
        return null;
    }

    try {
        return unsafePlayer.getPlayerResponse();
    } catch (e) {
        console.warn('[YT EQ] Failed to read player response', e);
        return null;
    }
}

// Load settings
function loadSettings() {
    const saved = localStorage.getItem('yt-eq-settings');
    if (saved) {
        try {
            eqSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        } catch (e) {
            console.error('Failed to parse EQ settings', e);
        }
    }
}

// Save settings
function saveSettings() {
    localStorage.setItem('yt-eq-settings', JSON.stringify(eqSettings));
}

function initWebAudio(video) {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    if (currentVideoElement !== video) {
        if (sourceNode) {
            sourceNode.disconnect();
        }

        try {
            sourceNode = audioCtx.createMediaElementSource(video);

            // Create Nodes
            preampNode = audioCtx.createGain();
            normalizerNode = audioCtx.createGain();

            // Create Brickwall Limiter
            limiterNode = audioCtx.createDynamicsCompressor();
            limiterNode.threshold.value = -0.1; // Catch peaks just under 0dB
            limiterNode.knee.value = 0.0;       // Hard knee
            limiterNode.ratio.value = 20.0;     // High ratio for brickwall
            limiterNode.attack.value = 0.001;   // Very fast attack
            limiterNode.release.value = 0.050;  // Fast release

            // Create 10-band EQ
            filterNodes = EQ_BANDS.map(freq => {
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'peaking';
                filter.frequency.value = freq;
                filter.Q.value = 1.41; // typical Q value
                return filter;
            });

            // Chain connections: Source -> Preamp -> Filters[] -> Normalizer -> Limiter -> Destination
            sourceNode.connect(preampNode);
            let lastNode = preampNode;

            filterNodes.forEach(filter => {
                lastNode.connect(filter);
                lastNode = filter;
            });

            lastNode.connect(normalizerNode);
            normalizerNode.connect(limiterNode);
            limiterNode.connect(audioCtx.destination);

            currentVideoElement = video;
            applyEQSettingsToNodes();
            applyLimiterSettings();

        } catch (e) {
            console.error('[YT EQ] Failed to create or connect audio nodes', e);
        }
    }
}

function applyEQSettingsToNodes() {
    if (!preampNode || filterNodes.length === 0) return;

    if (eqSettings.enabled) {
        // Math.pow(10, db / 20) for GainNode
        preampNode.gain.value = Math.pow(10, eqSettings.preamp / 20);
        filterNodes.forEach((filter, idx) => {
            filter.gain.value = eqSettings.bands[idx];
        });
    } else {
        preampNode.gain.value = 1;
        filterNodes.forEach(filter => {
            filter.gain.value = 0;
        });
    }
}

function applyLimiterSettings() {
    if (!limiterNode) return;

    if (eqSettings.limiterEnabled) {
        // Activate Brickwall parameters
        limiterNode.threshold.value = -0.1;
        limiterNode.ratio.value = 20.0;
    } else {
        // Bypass effectively
        limiterNode.threshold.value = 0;
        limiterNode.ratio.value = 1.0;
    }
}

function applyNormalizerGain() {
    const moviePlayer = document.getElementById('movie_player');
    if (!moviePlayer) return;

    const playerResponse = getPlayerResponse(moviePlayer);
    const pageWindow = getPageWindow();
    const config = playerResponse?.playerConfig?.audioConfig ||
        pageWindow.ytInitialPlayerResponse?.playerConfig?.audioConfig;

    const loudnessDb = config?.loudnessDb || 0;

    // Normalizer applies gain.value based on loudnessDb
    if (normalizerNode) {
        if (eqSettings.normalizerEnabled && loudnessDb > 0) {
            const gainMultiplier = Math.pow(10, loudnessDb / 20);
            normalizerNode.gain.value = gainMultiplier;
            updateNormalizerUI(loudnessDb);
        } else {
            normalizerNode.gain.value = 1;
            updateNormalizerUI(loudnessDb);
        }
    }
}

// UI DOM Elements
let eqContainer = null;
let eqToggleButton = null;
let normalizerStatusSpan = null;

function updateNormalizerUI(loudnessDb) {
    if (normalizerStatusSpan) {
        if (eqSettings.normalizerEnabled && loudnessDb > 0) {
            normalizerStatusSpan.textContent = `${getMsg('normalizerOn')} +${loudnessDb.toFixed(1)}dB`;
            normalizerStatusSpan.style.color = '#e8e8e8';
        } else {
            normalizerStatusSpan.textContent = getMsg('normalizerOff');
            normalizerStatusSpan.style.color = '#888';
        }
    }
}

function createUI() {
    if (document.getElementById('yt-eq-container')) return;

    eqContainer = document.createElement('div');
    eqContainer.id = 'yt-eq-container';
    eqContainer.className = 'yt-eq-container yt-eq-visible';

    // --- Header ---
    const header = document.createElement('div');
    header.className = 'yt-eq-header';

    const titleMain = document.createElement('div');
    titleMain.className = 'yt-eq-title-main';

    // SVG Musical Note Icon
    const svgNS = "http://www.w3.org/2000/svg";
    const iconSvg = document.createElementNS(svgNS, "svg");
    iconSvg.setAttribute("width", "18");
    iconSvg.setAttribute("height", "18");
    iconSvg.setAttribute("viewBox", "0 0 24 24");
    iconSvg.setAttribute("fill", "#ffffff");
    const iconPath = document.createElementNS(svgNS, "path");
    iconPath.setAttribute("d", "M12 3v9.28a4.39 4.39 0 0 0-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z");
    iconSvg.appendChild(iconPath);

    const titleText = document.createElement('span');
    titleText.className = 'yt-eq-title-text';
    titleText.textContent = getMsg('title');

    titleMain.appendChild(iconSvg);
    titleMain.appendChild(titleText);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'yt-eq-close';
    closeBtn.textContent = '\u2715';
    closeBtn.onclick = () => {
        eqContainer.classList.remove('yt-eq-visible');
        if (eqToggleButton) eqToggleButton.classList.remove('active');
    };

    header.appendChild(titleMain);
    header.appendChild(closeBtn);

    // ====== BASIC MODE (3-Knob) ======
    const basicContent = document.createElement('div');
    basicContent.className = 'yt-eq-basic-controls';

    // Helper: Rotary Knob
    const createRotaryKnob = (label, getVal, onValChange) => {
        const container = document.createElement('div');
        container.className = 'yt-eq-knob-container';

        const labelEl = document.createElement('div');
        labelEl.className = 'yt-eq-knob-label';
        labelEl.textContent = label;

        const wrapper = document.createElement('div');
        wrapper.className = 'yt-eq-knob-wrapper';

        const bg = document.createElement('div');
        bg.className = 'yt-eq-knob-bg';

        const fg = document.createElement('div');
        fg.className = 'yt-eq-knob-fg';

        const center = document.createElement('div');
        center.className = 'yt-eq-knob-center';

        const indicator = document.createElement('div');
        indicator.className = 'yt-eq-knob-indicator';

        center.appendChild(indicator);
        wrapper.appendChild(bg);
        wrapper.appendChild(fg);
        wrapper.appendChild(center);

        const valEl = document.createElement('div');
        valEl.className = 'yt-eq-knob-value';

        container.appendChild(labelEl);
        container.appendChild(wrapper);
        container.appendChild(valEl);

        let isDragging = false;
        let startY = 0;
        let startVal = 0;
        const SENSITIVITY = 0.3; // db per pixel

        const render = () => {
            const val = getVal();
            // -20dB to 20dB mapped to 225deg to 495deg (270 arc)
            let pct = (val + 20) / 40;
            if (pct < 0) pct = 0;
            if (pct > 1) pct = 1;

            const fillDeg = pct * 270;
            fg.style.background = `conic-gradient(from 225deg, #ffffff ${fillDeg}deg, transparent ${fillDeg}deg)`;

            // Rotate indicator inside center
            const rotDeg = -135 + (pct * 270);
            indicator.style.transform = `rotate(${rotDeg}deg)`;
            center.style.transform = `rotate(${rotDeg}deg)`; // Also rotate the dial for better feedback

            valEl.textContent = `${val > 0 ? '+' : ''}${val.toFixed(1)}dB`;
        };

        wrapper.addEventListener('mousedown', (e) => {
            isDragging = true;
            startY = e.clientY;
            startVal = getVal();
            document.body.style.userSelect = 'none';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dy = startY - e.clientY; // up is positive
            const newVal = Math.max(-20, Math.min(20, startVal + (dy * SENSITIVITY)));
            onValChange(newVal);
            render();
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.userSelect = '';
                saveSettings(); // save only on mouse release
            }
        });

        render();
        return { container, render };
    };

    // Audio Mapping for Basic Mode -> Advanced Arrays
    // Low: 32, 64, 125 (indices 0, 1, 2)
    // Mid: 250, 500, 1k, 2k (indices 3, 4, 5, 6)
    // High: 4k, 8k, 16k (indices 7, 8, 9)
    const basicKnobs = [];

    // Helper to get average of bands for basic knob visualization
    const getAvgBand = (indices) => {
        const sum = indices.reduce((a, idx) => a + eqSettings.bands[idx], 0);
        return sum / indices.length;
    };

    const setBandGroup = (indices, val) => {
        indices.forEach(idx => {
            eqSettings.bands[idx] = val;
        });
        applyEQSettingsToNodes();
    };

    const knobPreamp = createRotaryKnob(getMsg('preamp'), () => eqSettings.preamp, (val) => {
        eqSettings.preamp = val;
        applyEQSettingsToNodes();
    });
    const knobLow = createRotaryKnob(getMsg('low'), () => getAvgBand([0, 1, 2]), (val) => setBandGroup([0, 1, 2], val));
    const knobMid = createRotaryKnob(getMsg('mid'), () => getAvgBand([3, 4, 5, 6]), (val) => setBandGroup([3, 4, 5, 6], val));
    const knobHigh = createRotaryKnob(getMsg('high'), () => getAvgBand([7, 8, 9]), (val) => setBandGroup([7, 8, 9], val));

    basicKnobs.push(knobPreamp, knobLow, knobMid, knobHigh);

    basicContent.appendChild(knobPreamp.container);
    basicContent.appendChild(knobLow.container);
    basicContent.appendChild(knobMid.container);
    basicContent.appendChild(knobHigh.container);

    // --- Footer ---
    const footer = document.createElement('div');
    footer.className = 'yt-eq-footer';

    const footerLeft = document.createElement('div');
    footerLeft.className = 'yt-eq-footer-left';

    // Normalizer Toggle Switch Area
    const normalizerWrapper = document.createElement('div');
    normalizerWrapper.className = 'yt-eq-toggle-wrapper';

    normalizerStatusSpan = document.createElement('span');
    normalizerStatusSpan.textContent = getMsg('normalizerOff');

    const switchLabel = document.createElement('label');
    switchLabel.className = 'yt-eq-switch';
    const switchInput = document.createElement('input');
    switchInput.type = 'checkbox';
    switchInput.checked = eqSettings.normalizerEnabled;
    const switchSpan = document.createElement('span');
    switchSpan.className = 'yt-eq-slider-toggle';

    switchInput.addEventListener('change', (e) => {
        eqSettings.normalizerEnabled = e.target.checked;
        saveSettings();
        applyNormalizerGain();
    });

    switchLabel.appendChild(switchInput);
    switchLabel.appendChild(switchSpan);

    normalizerWrapper.appendChild(normalizerStatusSpan);
    normalizerWrapper.appendChild(switchLabel);

    // Limiter Toggle Switch Area
    const limiterWrapper = document.createElement('div');
    limiterWrapper.className = 'yt-eq-toggle-wrapper';

    const limiterStatusSpan = document.createElement('span');
    limiterStatusSpan.textContent = getMsg('limiter');
    limiterStatusSpan.style.color = '#888';

    const limiterSwitchLabel = document.createElement('label');
    limiterSwitchLabel.className = 'yt-eq-switch';
    const limiterSwitchInput = document.createElement('input');
    limiterSwitchInput.type = 'checkbox';
    limiterSwitchInput.checked = eqSettings.limiterEnabled;
    const limiterSwitchSpan = document.createElement('span');
    limiterSwitchSpan.className = 'yt-eq-slider-toggle';

    limiterSwitchInput.addEventListener('change', (e) => {
        eqSettings.limiterEnabled = e.target.checked;
        saveSettings();
        applyLimiterSettings();
        limiterStatusSpan.style.color = e.target.checked ? '#e8e8e8' : '#888';
    });

    // Initial color
    limiterStatusSpan.style.color = eqSettings.limiterEnabled ? '#e8e8e8' : '#888';

    limiterSwitchLabel.appendChild(limiterSwitchInput);
    limiterSwitchLabel.appendChild(limiterSwitchSpan);

    limiterWrapper.appendChild(limiterStatusSpan);
    limiterWrapper.appendChild(limiterSwitchLabel);

    footerLeft.appendChild(normalizerWrapper);
    footerLeft.appendChild(limiterWrapper);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'yt-eq-reset-btn';
    resetBtn.textContent = getMsg('reset');
    resetBtn.onclick = () => {
        eqSettings.preamp = 0;
        eqSettings.bands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        basicKnobs.forEach(k => k.render());
        applyEQSettingsToNodes();
        saveSettings();
    };

    footer.appendChild(footerLeft);
    footer.appendChild(resetBtn);

    eqContainer.appendChild(header);
    eqContainer.appendChild(basicContent);
    eqContainer.appendChild(footer);

    const moviePlayer = document.getElementById('movie_player') || document.body;
    moviePlayer.appendChild(eqContainer);

    // Setup initial state visually
    eqContainer.classList.remove('yt-eq-visible');

    // Click outside to close
    document.addEventListener('click', (e) => {
        if (!eqContainer.classList.contains('yt-eq-visible')) return;

        const isClickInsideEQ = eqContainer.contains(e.target);
        const isClickOnToggle = eqToggleButton && eqToggleButton.contains(e.target);

        if (!isClickInsideEQ && !isClickOnToggle) {
            eqContainer.classList.remove('yt-eq-visible');
            if (eqToggleButton) eqToggleButton.classList.remove('active');
        }
    });

    // update status right away if loudness is already known
    applyNormalizerGain();
}

function injectEQButton() {
    if (document.getElementById('ytp-eq-button')) return;

    const rightControls = document.querySelector('.ytp-right-controls');
    if (!rightControls) return;

    eqToggleButton = document.createElement('button');
    eqToggleButton.id = 'ytp-eq-button';
    eqToggleButton.className = 'ytp-eq-button ytp-button';
    eqToggleButton.setAttribute('title', getMsg('tooltip'));

    const svgNS = "http://www.w3.org/2000/svg";
    const btnSvg = document.createElementNS(svgNS, "svg");
    btnSvg.setAttribute("viewBox", "0 0 24 24");

    const btnPath = document.createElementNS(svgNS, "path");
    btnPath.setAttribute("d", "M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z");
    btnSvg.appendChild(btnPath);

    eqToggleButton.appendChild(btnSvg);

    eqToggleButton.onclick = () => {
        if (!audioCtx) {
            // Attempt initialization if not done yet
            const video = document.querySelector('video');
            if (video) initWebAudio(video);
        }
        const isVisible = eqContainer.classList.contains('yt-eq-visible');
        if (isVisible) {
            eqContainer.classList.remove('yt-eq-visible');
            eqToggleButton.classList.remove('active');
        } else {
            eqContainer.classList.add('yt-eq-visible');
            eqToggleButton.classList.add('active');
        }
    };

    // Append the EQ button to the right controls.
    try {
        if (!rightControls.contains(eqToggleButton)) {
            // Place it at the far left of the right controls list
            rightControls.prepend(eqToggleButton);
        }
    } catch (e) {
        console.warn('[YT EQ] Failed to prepend button, falling back to append', e);
        try {
            rightControls.appendChild(eqToggleButton);
        } catch (e2) { }
    }
}

// Initialization and Event Loops
function init() {
    loadSettings();

    let checkCount = 0;
    const checkPlayer = setInterval(() => {
        const video = document.querySelector('video');
        const moviePlayer = document.getElementById('movie_player');
        const controls = document.querySelector('.ytp-right-controls');
        const hasPlayerResponse = !!getPlayerResponse(moviePlayer);

        if (video && moviePlayer && hasPlayerResponse && controls) {
            clearInterval(checkPlayer);

            initWebAudio(video);
            applyNormalizerGain();

            createUI();
            injectEQButton();

            if (!video.dataset.ytEqAttached) {
                video.addEventListener('loadeddata', () => {
                    initWebAudio(video);
                    applyNormalizerGain();
                });
                video.dataset.ytEqAttached = 'true';
            }
        }

        if (++checkCount > 100) clearInterval(checkPlayer);
    }, 500);
}

// SPA support
window.addEventListener('yt-navigate-finish', () => {
    setTimeout(() => {
        const video = document.querySelector('video');
        if (video) {
            initWebAudio(video);
            applyNormalizerGain();
        }
        injectEQButton(); // Re-inject if control bar was fully recreated
    }, 800);
});

window.addEventListener('yt-page-data-updated', () => {
    setTimeout(() => {
        const video = document.querySelector('video');
        if (video) {
            initWebAudio(video);
            applyNormalizerGain();
        }
    }, 800);
});

init();
