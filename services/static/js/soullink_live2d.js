/**
 * Soullink Live2D Emotion & Lip-Sync Driver (Touhou Pet Edition)
 * Inspired by nanlingyin/soullink-emotion-sdk
 *
 * Provides real-time VAD emotion interpolation, FACS muscle unit parameter driving,
 * Web Audio real-time Lip-Sync, and mouse eye-tracking for Live2D Cubism 3/4 models.
 */

class SoullinkLive2DDriver {
    constructor() {
        this.app = null;
        this.model = null;
        this.currentModelUrl = null;
        this.targetEmotion = "normal";
        this.currentVAD = { v: 0.0, a: 0.0, d: 0.0 }; // Valence, Arousal, Dominance
        this.targetVAD = { v: 0.0, a: 0.0, d: 0.0 };
        this.isLoaded = false;
        
        // Lip-Sync Web Audio
        this.audioCtx = null;
        this.analyser = null;
        this.audioSourceNode = null;
        this.isLipSyncActive = false;
        this.lipSyncRaf = null;

        // VAD 情绪映射坐标系
        this.EMOTION_VAD_MAP = {
            "normal":   { v: 0.1,  a: 0.0,  d: 0.0 },
            "happy":    { v: 0.85, a: 0.7,  d: 0.3 },
            "shy":      { v: 0.5,  a: 0.4,  d: -0.6 },
            "angry":    { v: -0.8, a: 0.85, d: 0.7 },
            "crying":   { v: -0.9, a: -0.3, d: -0.7 },
            "sleeping": { v: 0.0,  a: -0.9, d: -0.9 },
            "peeking_left":  { v: 0.2, a: 0.3, d: 0.1 },
            "peeking_right": { v: 0.2, a: 0.3, d: 0.1 }
        };
    }

    /**
     * 初始化 Pixi Application 并加载指定的 Live2D 模型
     * @param {HTMLCanvasElement} canvas 
     * @param {string} modelUrl 
     * @param {Object} options 
     */
    async load(canvas, modelUrl, options = {}) {
        if (!canvas || !modelUrl) return false;
        if (this.currentModelUrl === modelUrl && this.model) {
            return true;
        }

        try {
            this.destroy();
            this.currentModelUrl = modelUrl;

            // 确保 Canvas 元素及其容器背景绝对透明
            canvas.style.background = 'transparent';
            canvas.style.backgroundColor = 'transparent';

            // 1. 初始化 PIXI 应用
            const parent = canvas.parentElement || document.body;
            const width = Math.max(320, canvas.clientWidth || parent.clientWidth || 320);
            const height = Math.max(380, canvas.clientHeight || parent.clientHeight || 380);

            this.app = new PIXI.Application({
                view: canvas,
                backgroundAlpha: 0, // PIXI v7 核心透明配置（修复黑色底色）
                clearBeforeRender: true,
                autoDensity: true,
                antialias: true,
                resolution: Math.max(window.devicePixelRatio || 1, 2),
                width: width,
                height: height
            });

            // 2. 加载 Live2D 模型
            console.log(`[SOULLINK LIVE2D] 正在加载模型: ${modelUrl}`);
            const Live2DModel = PIXI.live2d ? PIXI.live2d.Live2DModel : null;
            if (!Live2DModel) {
                console.error("[SOULLINK LIVE2D] PIXI.live2d 未注册或 live2d 库未加载");
                return false;
            }

            this.model = await Live2DModel.from(modelUrl, {
                autoInteract: true,
                motionPreload: 'ALL'
            });

            if (!this.model) {
                console.error("[SOULLINK LIVE2D] 加载模型对象失败");
                return false;
            }

            // 3. 计算自适应缩放并居中
            this.app.stage.addChild(this.model);
            this.resizeModel(width, height);

            // 4. 注册 Ticker 驱动微表情与呼吸插值
            this.app.ticker.add((delta) => this.onTick(delta));

            // 5. 绑定点击互动
            this.model.on('hit', (hitAreas) => {
                console.log(`[SOULLINK LIVE2D] Hit:`, hitAreas);
                if (hitAreas.includes('head') || hitAreas.includes('Head')) {
                    this.triggerRandomMotion(['tap_head', 'touch_head', 'flick_head']);
                } else if (hitAreas.includes('body') || hitAreas.includes('Body')) {
                    this.triggerRandomMotion(['tap_body', 'touch_body', 'shake']);
                }
            });

            this.isLoaded = true;
            console.log(`[SOULLINK LIVE2D] 模型加载成功: ${modelUrl}`);
            return true;
        } catch (e) {
            console.error(`[SOULLINK LIVE2D ERROR] 加载模型失败:`, e);
            return false;
        }
    }

    /**
     * 自适应调整模型尺寸与居中位置（适度放大，让模型主体饱满充盈窗口）
     */
    resizeModel(viewWidth, viewHeight) {
        if (!this.model) return;
        const rawW = this.model.width || 1;
        const rawH = this.model.height || 1;

        // 计算饱满缩放比：充分利用视口高度，使模型大小与 300px PNG 立绘高度相当
        const scaleX = (viewWidth * 1.35) / rawW;
        const scaleY = (viewHeight * 1.35) / rawH;
        const finalScale = Math.min(scaleX, scaleY);

        this.model.scale.set(finalScale);
        this.model.anchor.set(0.5, 0.5);
        this.model.x = viewWidth / 2;
        this.model.y = viewHeight / 2 + 15; // 居中偏下，贴合输入栏
    }

    /**
     * 设置角色情感（通过 Soullink VAD 插值与 FACS 肌肉单元实时驱动）
     * @param {string} emotion normal | happy | shy | angry | crying | sleeping
     */
    setEmotion(emotion) {
        this.targetEmotion = emotion || "normal";
        const target = this.EMOTION_VAD_MAP[this.targetEmotion] || this.EMOTION_VAD_MAP.normal;
        this.targetVAD = { ...target };

        // 尝试触发内置的命名表情 (如果模型自带 Expression)
        if (this.model && this.model.internalModel && this.model.internalModel.motionManager) {
            try {
                this.model.expression(this.targetEmotion);
            } catch (e) {
                // 模型未定义对应名字的表情时忽略
            }
        }
    }

    /**
     * 每帧执行 VAD 连续情感平滑过渡与 FACS 微表情参数注入
     */
    onTick(delta) {
        if (!this.model || !this.isLoaded) return;

        // 1. 平滑逼近目标 VAD
        const lerpFactor = 0.08 * (delta || 1);
        this.currentVAD.v += (this.targetVAD.v - this.currentVAD.v) * lerpFactor;
        this.currentVAD.a += (this.targetVAD.a - this.currentVAD.a) * lerpFactor;
        this.currentVAD.d += (this.targetVAD.d - this.currentVAD.d) * lerpFactor;

        const v = this.currentVAD.v; // -1.0 ~ 1.0 (消极 ~ 积极)
        const a = this.currentVAD.a; // -1.0 ~ 1.0 (低唤醒 ~ 高激动)
        const d = this.currentVAD.d; // -1.0 ~ 1.0 (顺从/自闭 ~ 自信/傲娇)

        const coreModel = this.model.internalModel ? this.model.internalModel.coreModel : null;
        if (!coreModel) return;

        // 2. FACS 肌肉单元驱动 (Facial Action Coding System)
        try {
            // 嘴形嘴角弯曲度 (ParamMouthForm: 1为微笑向上，-1为撇嘴向下)
            const targetMouthForm = Math.max(-1, Math.min(1, v * 1.2));
            this.applyParam(coreModel, ['ParamMouthForm', 'PARAM_MOUTH_FORM'], targetMouthForm, 0.1);

            // 脸红 (ParamCheek: 0为正常，1为脸红害羞)
            const isShyOrHappy = (this.targetEmotion === 'shy') ? 0.9 : (v > 0.5 ? 0.4 : 0);
            this.applyParam(coreModel, ['ParamCheek', 'PARAM_CHEEK'], isShyOrHappy, 0.05);

            // 眉毛高度与倾斜 (ParamBrowLY, ParamBrowRY, ParamBrowLAngle)
            if (this.targetEmotion === 'angry') {
                this.applyParam(coreModel, ['ParamBrowLY', 'ParamBrowRY', 'PARAM_BROW_L_Y', 'PARAM_BROW_R_Y'], -0.6, 0.1);
                this.applyParam(coreModel, ['ParamBrowLAngle', 'ParamBrowRAngle', 'PARAM_BROW_L_ANGLE'], -0.8, 0.1);
            } else if (this.targetEmotion === 'crying') {
                this.applyParam(coreModel, ['ParamBrowLY', 'ParamBrowRY', 'PARAM_BROW_L_Y', 'PARAM_BROW_R_Y'], -0.3, 0.1);
                this.applyParam(coreModel, ['ParamBrowLAngle', 'ParamBrowRAngle', 'PARAM_BROW_L_ANGLE'], 0.7, 0.1);
            }

            // 睡眠状态闭眼
            if (this.targetEmotion === 'sleeping') {
                this.applyParam(coreModel, ['ParamEyeLOpen', 'ParamEyeROpen', 'PARAM_EYE_L_OPEN', 'PARAM_EYE_R_OPEN'], 0.0, 0.15);
            }
        } catch (e) {
            // 个别模型可能没有某些标准参数，安全忽略
        }
    }

    /**
     * 安全注入模型参数
     */
    applyParam(coreModel, paramNames, targetValue, lerpWeight = 0.1) {
        if (!coreModel) return;
        for (const name of paramNames) {
            try {
                if (typeof coreModel.getParameterValueById === 'function') {
                    const currentVal = coreModel.getParameterValueById(name);
                    if (currentVal !== undefined && !isNaN(currentVal)) {
                        const nextVal = currentVal + (targetValue - currentVal) * lerpWeight;
                        coreModel.setParameterValueById(name, nextVal);
                        return;
                    }
                }
            } catch (e) {}
        }
    }

    /**
     * 鼠标视线追踪
     */
    focus(clientX, clientY) {
        if (!this.model || !this.isLoaded) return;
        try {
            this.model.focus(clientX, clientY);
        } catch (e) {}
    }

    /**
     * 绑定 HTMLAudioElement 实现实时音频对口型 (Web Audio Lip-Sync)
     * @param {HTMLAudioElement} audioElement 
     */
    attachAudioLipSync(audioElement) {
        if (!audioElement) return;

        try {
            if (!this.audioCtx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                this.audioCtx = new AudioCtx();
            }
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            // 创建 AnalyserNode
            if (!this.analyser) {
                this.analyser = this.audioCtx.createAnalyser();
                this.analyser.fftSize = 256;
            }

            // 避免重复创建 MediaElementSource
            if (!audioElement.__soullink_source_node) {
                try {
                    const source = this.audioCtx.createMediaElementSource(audioElement);
                    source.connect(this.analyser);
                    this.analyser.connect(this.audioCtx.destination);
                    audioElement.__soullink_source_node = source;
                } catch (sourceErr) {
                    console.warn("[SOULLINK LIPSYNC WARN] 无法直连 MediaElementSource:", sourceErr);
                }
            }

            // 监听音频播放与停止
            audioElement.addEventListener('play', () => {
                this.startLipSyncLoop();
            });

            audioElement.addEventListener('pause', () => {
                this.stopLipSyncLoop();
            });

            audioElement.addEventListener('ended', () => {
                this.stopLipSyncLoop();
            });
        } catch (e) {
            console.error("[SOULLINK LIPSYNC ERROR]", e);
        }
    }

    startLipSyncLoop() {
        this.isLipSyncActive = true;
        const dataArray = new Uint8Array(this.analyser ? this.analyser.frequencyBinCount : 128);

        const loop = () => {
            if (!this.isLipSyncActive) {
                this.resetMouth();
                return;
            }

            if (this.analyser && this.model && this.model.internalModel && this.model.internalModel.coreModel) {
                this.analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const average = sum / dataArray.length;
                // 计算开合度 (0.0 ~ 1.0)
                const mouthOpen = Math.min(1.0, Math.max(0.0, (average - 15) / 60));

                const coreModel = this.model.internalModel.coreModel;
                this.applyParam(coreModel, ['ParamMouthOpenY', 'PARAM_MOUTH_OPEN_Y'], mouthOpen, 0.4);
            }

            this.lipSyncRaf = requestAnimationFrame(loop);
        };

        if (this.lipSyncRaf) cancelAnimationFrame(this.lipSyncRaf);
        this.lipSyncRaf = requestAnimationFrame(loop);
    }

    stopLipSyncLoop() {
        this.isLipSyncActive = false;
        if (this.lipSyncRaf) {
            cancelAnimationFrame(this.lipSyncRaf);
            this.lipSyncRaf = null;
        }
        this.resetMouth();
    }

    resetMouth() {
        if (this.model && this.model.internalModel && this.model.internalModel.coreModel) {
            const coreModel = this.model.internalModel.coreModel;
            this.applyParam(coreModel, ['ParamMouthOpenY', 'PARAM_MOUTH_OPEN_Y'], 0.0, 0.2);
        }
    }

    /**
     * 随机触发可用的 Motion
     */
    triggerRandomMotion(candidateGroups = []) {
        if (!this.model) return;
        for (const group of candidateGroups) {
            try {
                this.model.motion(group);
                return;
            } catch (e) {}
        }
    }

    destroy() {
        this.stopLipSyncLoop();
        if (this.model) {
            try {
                this.model.destroy();
            } catch (e) {}
            this.model = null;
        }
        if (this.app) {
            try {
                this.app.destroy(true, { children: true, texture: true, baseTexture: true });
            } catch (e) {}
            this.app = null;
        }
        this.isLoaded = false;
        this.currentModelUrl = null;
    }
}

// 挂载全局单例
window.SoullinkLive2D = new SoullinkLive2DDriver();
