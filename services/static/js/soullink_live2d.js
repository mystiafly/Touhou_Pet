/**
 * Soullink Live2D Emotion & Lip-Sync Driver (Touhou Pet Edition)
 * Inspired by nanlingyin/soullink-emotion-sdk
 *
 * Provides real-time VAD emotion interpolation, FACS muscle unit parameter driving,
 * Web Audio real-time Lip-Sync, custom scale/offset transform, and eye-tracking.
 */

class SoullinkLive2DDriver {
    constructor() {
        this.app = null;
        this.model = null;
        this.currentModelUrl = null;
        this.canvas = null;
        this.targetEmotion = "normal";
        this.currentVAD = { v: 0.1, a: 0.0, d: 0.0 }; // Valence, Arousal, Dominance
        this.targetVAD = { v: 0.1, a: 0.0, d: 0.0 };
        this.isLoaded = false;
        
        // 自定义缩放与偏移
        this.customScale = 1.0;
        this.customOffsetX = 0.0;
        this.customOffsetY = 0.0;

        // 视线与头部跟随坐标
        this.targetFocusX = 0.0;
        this.targetFocusY = 0.0;
        this.currentFocusX = 0.0;
        this.currentFocusY = 0.0;

        // Lip-Sync Web Audio
        this.audioCtx = null;
        this.analyser = null;
        this.isSpeaking = false;
        this.currentMouthOpen = 0.0;
        this.targetMouthOpen = 0.0;
        this.lipSyncParamIds = ['ParamMouthOpenY', 'ParamA', 'PARAM_MOUTH_OPEN_Y', 'PARAM_A', 'ParamMouthA'];

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
     * 设置自定义变换参数（缩放、X偏移、Y偏移）
     */
    setTransform(scale = 1.0, offsetX = 0.0, offsetY = 0.0) {
        this.customScale = (typeof scale === 'number' && !isNaN(scale)) ? scale : 1.0;
        this.customOffsetX = (typeof offsetX === 'number' && !isNaN(offsetX)) ? offsetX : 0.0;
        this.customOffsetY = (typeof offsetY === 'number' && !isNaN(offsetY)) ? offsetY : 0.0;

        if (this.app && this.app.renderer) {
            const width = this.app.renderer.width / (this.app.renderer.resolution || 1);
            const height = this.app.renderer.height / (this.app.renderer.resolution || 1);
            this.resizeModel(width, height);
        }
    }

    /**
     * 初始化 Pixi Application 并加载指定的 Live2D 模型
     * @param {HTMLCanvasElement} canvas 
     * @param {string} modelUrl 
     */
    async load(canvas, modelUrl) {
        if (!canvas || !modelUrl) return false;
        if (this.currentModelUrl === modelUrl && this.model) {
            return true;
        }

        try {
            this.destroy();
            this.currentModelUrl = modelUrl;
            this.canvas = canvas;

            // 确保 Canvas 元素及其容器背景绝对透明
            canvas.style.background = 'transparent';
            canvas.style.backgroundColor = 'transparent';

            // 1. 初始化 PIXI 应用
            const parent = canvas.parentElement || document.body;
            const width = Math.max(320, canvas.clientWidth || parent.clientWidth || 320);
            const height = Math.max(360, canvas.clientHeight || parent.clientHeight || 360);

            this.app = new PIXI.Application({
                view: canvas,
                backgroundAlpha: 0, // PIXI v7 核心透明配置
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

            // 3. 检测模型内置的 LipSync 参数组
            this.discoverModelCapabilities();

            // 4. 计算自适应缩放并居中
            this.app.stage.addChild(this.model);
            this.resizeModel(width, height);

            // 5. 挂载每帧参数注入 Hook (在 Motion 计算之后注入，防止被动作覆写)
            if (this.model.internalModel) {
                this.model.internalModel.on('afterMotionUpdate', () => {
                    this.applyParametersOnMotionUpdate();
                });
            }

            // 6. 注册 Ticker 驱动微表情与音频插值
            this.app.ticker.add((delta) => this.onTick(delta));

            // 7. 绑定点击互动
            this.model.on('hit', (hitAreas) => {
                console.log(`[SOULLINK LIVE2D] Hit:`, hitAreas);
                if (hitAreas.some(h => /head|face/i.test(h))) {
                    this.triggerRandomMotion(['tap_head', 'touch_head', 'flick_head', '']);
                } else if (hitAreas.some(h => /body|chest|arm/i.test(h))) {
                    this.triggerRandomMotion(['tap_body', 'touch_body', 'shake', '']);
                } else {
                    this.triggerRandomMotion();
                }
            });

            this.isLoaded = true;
            console.log(`[SOULLINK LIVE2D] 模型加载成功: ${modelUrl}`);

            // 播放初始动作与表情
            this.triggerRandomMotion();
            this.setEmotion('normal');

            return true;
        } catch (e) {
            console.error(`[SOULLINK LIVE2D ERROR] 加载模型失败:`, e);
            return false;
        }
    }

    /**
     * 自动解析模型的内置参数名与可用表情/动作组
     */
    discoverModelCapabilities() {
        if (!this.model || !this.model.internalModel) return;
        const settings = this.model.internalModel.settings;
        if (!settings) return;

        // 提取 LipSync 参数 Ids
        if (settings.groups) {
            for (const g of settings.groups) {
                if (g.Name === 'LipSync' && Array.isArray(g.Ids)) {
                    for (const id of g.Ids) {
                        if (!this.lipSyncParamIds.includes(id)) {
                            this.lipSyncParamIds.unshift(id);
                        }
                    }
                }
            }
        }
        console.log("[SOULLINK LIVE2D] 识别到的口型同步参数:", this.lipSyncParamIds);
    }

    /**
     * 自适应调整模型尺寸与居中位置 (结合自定义缩放与平移)
     */
    resizeModel(viewWidth, viewHeight) {
        if (!this.model) return;
        const rawW = this.model.width || 1;
        const rawH = this.model.height || 1;

        const scaleX = (viewWidth * 1.35) / rawW;
        const scaleY = (viewHeight * 1.35) / rawH;
        const baseScale = Math.min(scaleX, scaleY);
        const finalScale = baseScale * (this.customScale || 1.0);

        this.model.scale.set(finalScale);
        this.model.anchor.set(0.5, 0.5);
        this.model.x = (viewWidth / 2) + (this.customOffsetX || 0);
        this.model.y = (viewHeight / 2 + 15) + (this.customOffsetY || 0);
    }

    /**
     * 设置角色情感（通过 Soullink VAD 插值与 FACS 肌肉单元实时驱动）
     * @param {string} emotion normal | happy | shy | angry | crying | sleeping
     */
    setEmotion(emotion) {
        this.targetEmotion = emotion || "normal";
        const target = this.EMOTION_VAD_MAP[this.targetEmotion] || this.EMOTION_VAD_MAP.normal;
        this.targetVAD = { ...target };

        if (!this.model || !this.model.internalModel) return;

        // 1. 尝试触发内置的命名表情或索引
        try {
            const expressions = this.model.internalModel.settings.expressions || [];
            let matchedExp = null;

            if (expressions.length > 0) {
                const emotionKey = this.targetEmotion.toLowerCase();
                for (let i = 0; i < expressions.length; i++) {
                    const exp = expressions[i];
                    const name = (exp.Name || exp.name || "").toLowerCase();
                    const file = (exp.File || exp.file || "").toLowerCase();
                    if (
                        name.includes(emotionKey) || file.includes(emotionKey) ||
                        (emotionKey === 'happy' && (name.includes('smile') || name.includes('02') || i === 1)) ||
                        (emotionKey === 'angry' && (name.includes('anger') || name.includes('03') || i === 2)) ||
                        (emotionKey === 'shy' && (name.includes('blush') || name.includes('04') || i === 3)) ||
                        (emotionKey === 'crying' && (name.includes('sad') || name.includes('05') || i === 4)) ||
                        (emotionKey === 'sleeping' && (name.includes('sleep') || name.includes('06') || i === 5))
                    ) {
                        matchedExp = exp.Name || i;
                        break;
                    }
                }

                if (matchedExp !== null) {
                    this.model.expression(matchedExp);
                } else if (emotionKey === 'normal' && expressions.length > 0) {
                    this.model.expression(expressions[0].Name || 0);
                }
            }
        } catch (e) {
            console.warn("[SOULLINK LIVE2D] 表情切换提示:", e);
        }

        // 2. 触发对应的肢体微动作
        if (this.targetEmotion !== 'normal' && this.targetEmotion !== 'sleeping') {
            this.triggerRandomMotion();
        }
    }

    /**
     * 每帧执行 VAD 连续情感平滑过渡、视线平滑追踪与口型振幅计算
     */
    onTick(delta) {
        if (!this.model || !this.isLoaded) return;

        // 1. 平滑逼近目标 VAD
        const lerpFactor = 0.08 * (delta || 1);
        this.currentVAD.v += (this.targetVAD.v - this.currentVAD.v) * lerpFactor;
        this.currentVAD.a += (this.targetVAD.a - this.currentVAD.a) * lerpFactor;
        this.currentVAD.d += (this.targetVAD.d - this.currentVAD.d) * lerpFactor;

        // 2. 平滑追踪视线坐标
        const focusLerp = 0.15 * (delta || 1);
        this.currentFocusX += (this.targetFocusX - this.currentFocusX) * focusLerp;
        this.currentFocusY += (this.targetFocusY - this.currentFocusY) * focusLerp;

        // 3. 口型振幅计算 (Analyser 能量 + 语音声学自然波动双重驱动)
        if (this.isSpeaking) {
            let audioVolume = 0.5;
            if (this.analyser) {
                const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
                this.analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const avg = sum / dataArray.length;
                if (avg > 5) {
                    audioVolume = Math.min(1.0, avg / 50.0);
                }
            }

            const time = Date.now() / 1000;
            const phonemeWave = (Math.sin(time * 18) * 0.4 + 0.6) * (Math.sin(time * 7) * 0.2 + 0.8);
            this.targetMouthOpen = Math.min(1.0, Math.max(0.1, audioVolume * phonemeWave));
        } else {
            this.targetMouthOpen = 0.0;
        }

        this.currentMouthOpen += (this.targetMouthOpen - this.currentMouthOpen) * 0.35;
    }

    /**
     * 在动作系统更新完成后注入 Live2D 参数 (口型、视线追踪、微表情)
     */
    applyParametersOnMotionUpdate() {
        if (!this.model || !this.model.internalModel || !this.model.internalModel.coreModel) return;
        const coreModel = this.model.internalModel.coreModel;

        const v = this.currentVAD.v;
        const mouthOpen = this.currentMouthOpen;
        const fx = this.currentFocusX;
        const fy = this.currentFocusY;

        try {
            // 1. 口型参数强制注入 (多参数兼容)
            for (const paramId of this.lipSyncParamIds) {
                this.setCoreParam(coreModel, paramId, mouthOpen);
            }

            // 2. 视线与头部追踪参数注入
            this.setCoreParam(coreModel, 'ParamAngleX', fx * 30);
            this.setCoreParam(coreModel, 'ParamAngleY', -fy * 30);
            this.setCoreParam(coreModel, 'ParamAngleZ', fx * -10);
            this.setCoreParam(coreModel, 'ParamEyeBallX', fx);
            this.setCoreParam(coreModel, 'ParamEyeBallY', -fy);
            this.setCoreParam(coreModel, 'ParamBodyAngleX', fx * 10);
            this.setCoreParam(coreModel, 'PARAM_ANGLE_X', fx * 30);
            this.setCoreParam(coreModel, 'PARAM_ANGLE_Y', -fy * 30);
            this.setCoreParam(coreModel, 'PARAM_EYE_BALL_X', fx);
            this.setCoreParam(coreModel, 'PARAM_EYE_BALL_Y', -fy);

            // 3. FACS 肌肉单元与微表情注入
            const targetMouthForm = Math.max(-1, Math.min(1, v * 1.2));
            this.setCoreParam(coreModel, 'ParamMouthForm', targetMouthForm);
            this.setCoreParam(coreModel, 'PARAM_MOUTH_FORM', targetMouthForm);

            // 脸红
            const isShyOrHappy = (this.targetEmotion === 'shy') ? 0.9 : (v > 0.5 ? 0.4 : 0);
            this.setCoreParam(coreModel, 'ParamCheek', isShyOrHappy);
            this.setCoreParam(coreModel, 'PARAM_CHEEK', isShyOrHappy);

            // 眉毛与眨眼
            if (this.targetEmotion === 'angry') {
                this.setCoreParam(coreModel, 'ParamBrowLY', -0.6);
                this.setCoreParam(coreModel, 'ParamBrowRY', -0.6);
                this.setCoreParam(coreModel, 'ParamBrowLAngle', -0.8);
                this.setCoreParam(coreModel, 'ParamBrowRAngle', -0.8);
            } else if (this.targetEmotion === 'crying') {
                this.setCoreParam(coreModel, 'ParamBrowLY', -0.3);
                this.setCoreParam(coreModel, 'ParamBrowRY', -0.3);
                this.setCoreParam(coreModel, 'ParamBrowLAngle', 0.7);
                this.setCoreParam(coreModel, 'ParamBrowRAngle', 0.7);
            } else if (this.targetEmotion === 'sleeping') {
                this.setCoreParam(coreModel, 'ParamEyeLOpen', 0.0);
                this.setCoreParam(coreModel, 'ParamEyeROpen', 0.0);
            }
        } catch (e) {
            // 忽略个别模型没有的参数
        }
    }

    /**
     * 安全写入 CoreModel 参数
     */
    setCoreParam(coreModel, paramName, value) {
        if (!coreModel) return;
        try {
            if (typeof coreModel.setParameterValueById === 'function') {
                coreModel.setParameterValueById(paramName, value);
            } else if (typeof coreModel.setParameterValueByIndex === 'function') {
                const idx = coreModel.getParameterIndex(paramName);
                if (idx >= 0) {
                    coreModel.setParameterValueByIndex(idx, value);
                }
            }
        } catch (e) {}
    }

    /**
     * 鼠标视线追踪 (支持传入 Canvas 元素以进行精确相对视线投影)
     */
    focus(clientX, clientY, canvasElement = null) {
        if (!this.model || !this.isLoaded) return;
        try {
            const targetCanvas = canvasElement || this.canvas;
            if (targetCanvas) {
                const rect = targetCanvas.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                this.targetFocusX = Math.max(-1, Math.min(1, (clientX - centerX) / (rect.width / 2 || 1)));
                this.targetFocusY = Math.max(-1, Math.min(1, (clientY - centerY) / (rect.height / 2 || 1)));
                this.model.focus(clientX - rect.left, clientY - rect.top);
            } else {
                this.model.focus(clientX, clientY);
            }
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

            if (!this.analyser) {
                this.analyser = this.audioCtx.createAnalyser();
                this.analyser.fftSize = 128;
            }

            // 监听音频播放与停止
            audioElement.addEventListener('play', () => {
                if (this.audioCtx && this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume();
                }
                this.isSpeaking = true;
                this.triggerRandomMotion();
            });

            audioElement.addEventListener('pause', () => {
                this.isSpeaking = false;
            });

            audioElement.addEventListener('ended', () => {
                this.isSpeaking = false;
            });
        } catch (e) {
            console.error("[SOULLINK LIPSYNC ERROR]", e);
        }
    }

    /**
     * 随机触发可用的动作 Motion
     */
    triggerRandomMotion(candidateGroups = []) {
        if (!this.model || !this.model.internalModel) return;
        const motionManager = this.model.internalModel.motionManager;
        if (!motionManager || !motionManager.definitions) return;

        const availableGroups = Object.keys(motionManager.definitions);
        if (availableGroups.length === 0) return;

        // 如果指定了候选组，优先在候选组里找
        for (const grp of candidateGroups) {
            if (availableGroups.includes(grp)) {
                try {
                    this.model.motion(grp);
                    return;
                } catch (e) {}
            }
        }

        // 随机在所有动作组中播放
        const randomGrp = availableGroups[Math.floor(Math.random() * availableGroups.length)];
        try {
            this.model.motion(randomGrp);
        } catch (e) {}
    }

    destroy() {
        this.isSpeaking = false;
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
        this.canvas = null;
    }
}

// 挂载全局单例
window.SoullinkLive2D = new SoullinkLive2DDriver();
