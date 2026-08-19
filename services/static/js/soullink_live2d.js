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
        this.isSleeping = false;
        this.isDragging = false;
        this.currentMouthOpen = 0.0;
        this.targetMouthOpen = 0.0;
        this.lipSyncParamIds = ['ParamMouthOpenY', 'ParamA', 'PARAM_MOUTH_OPEN_Y', 'PARAM_A', 'ParamMouthA'];

        // 动作组分类管理 (点击组、拖拽组、特殊组、待机组)
        this.tapMotions = [];
        this.dragMotions = [];
        this.specialMotions = [];
        this.idleMotions = [];
        this.allMotionGroups = [];
        this.idleMotionTimer = null;
        this.lastMotionTriggerTime = 0;

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

            // 缓存未缩放前的原始模型宽高 (防止 scale.set 改变 model.width 产生递归乘积放大)
            this.rawModelWidth = this.model.internalModel?.originalWidth || this.model.internalModel?.width || this.model.width || 1000;
            this.rawModelHeight = this.model.internalModel?.originalHeight || this.model.internalModel?.height || this.model.height || 1000;

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
                console.log(`[SOULLINK LIVE2D] HitAreas:`, hitAreas);
                if (hitAreas.some(h => /head|face/i.test(h))) {
                    this.triggerTapMotion(['tap_head', 'touch_head', 'hit_head', 'tap']);
                } else if (hitAreas.some(h => /body|chest|arm/i.test(h))) {
                    this.triggerTapMotion(['tap_body', 'touch_body', 'hit_body', 'tap']);
                } else {
                    this.triggerTapMotion();
                }
            });

            this.isLoaded = true;
            console.log(`[SOULLINK LIVE2D] 模型加载成功: ${modelUrl}`);

            // 播放初始动作与表情，并启动日常待机自发动作调度器
            this.triggerIdleMotion();
            this.setEmotion('normal');
            this.startIdleMotionScheduler();

            return true;
        } catch (e) {
            console.error(`[SOULLINK LIVE2D ERROR] 加载模型失败:`, e);
            return false;
        }
    }

    /**
     * 自动解析模型的内置参数名与可用表情/动作组 (分类为 点击组、拖拽组、特殊组、待机组)
     */
    discoverModelCapabilities() {
        if (!this.model || !this.model.internalModel) return;
        const settings = this.model.internalModel.settings;
        const motionManager = this.model.internalModel.motionManager;

        // 1. 提取 LipSync 参数 Ids
        if (settings && settings.groups) {
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

        // 2. 扫描并分类全部动作组 (Motion Groups)
        this.tapMotions = [];
        this.dragMotions = [];
        this.specialMotions = [];
        this.idleMotions = [];
        this.allMotionGroups = [];

        if (motionManager && motionManager.definitions) {
            this.allMotionGroups = Object.keys(motionManager.definitions);
            
            for (const grp of this.allMotionGroups) {
                const lower = grp.toLowerCase().trim();
                
                // ① 待机组 (Idle)
                if (lower === '' || /idle|standby|normal|wait|loop/i.test(lower)) {
                    this.idleMotions.push(grp);
                }
                // ② 点击组 (Tap / Touch / Click / Hit)
                else if (/tap|touch|click|hit|interact|poke|head|body/i.test(lower)) {
                    this.tapMotions.push(grp);
                }
                // ③ 拖拽组 (Flick / Shake / Drag / Move / Drop)
                else if (/flick|shake|drag|move|drop|pan|lift/i.test(lower)) {
                    this.dragMotions.push(grp);
                }
                // ④ 特殊组 (Special / Extra / Dance / Sing / Pose / Action)
                else if (/special|extra|dance|sing|magic|pose|action|attack|unique|skill|show/i.test(lower)) {
                    this.specialMotions.push(grp);
                }
                // 其它未明确命名的非待机动作归入特殊组
                else {
                    this.specialMotions.push(grp);
                }
            }

            console.log(`[SOULLINK LIVE2D] 动作组智能分类完成:`, {
                点击组_Tap: this.tapMotions,
                拖拽组_Drag: this.dragMotions,
                特殊组_Special: this.specialMotions,
                待机组_Idle: this.idleMotions,
                全部动作组: this.allMotionGroups
            });
        }
    }

    /**
     * 自适应调整模型尺寸与居中位置 (结合自定义缩放与平移)
     */
    resizeModel(viewWidth, viewHeight) {
        if (!this.model) return;
        const rawW = this.rawModelWidth || 1000;
        const rawH = this.rawModelHeight || 1000;

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

        // 2. 状态切换与肢体动作联动
        if (this.targetEmotion === 'sleeping') {
            this.isSleeping = true;
            this.stopIdleMotionScheduler();
        } else {
            const wasSleeping = this.isSleeping;
            this.isSleeping = false;
            if (wasSleeping) {
                this.startIdleMotionScheduler();
            }
            if (this.targetEmotion !== 'normal') {
                this.triggerRandomMotion();
            }
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
     * 1. 触发【点击组】动作 (用户点击/戳一戳交互)
     */
    triggerTapMotion(preferredList = []) {
        if (!this.model || !this.isLoaded || this.isSleeping) return;
        
        console.log("[SOULLINK LIVE2D] 触发【点击组】动作交互");

        // 优先在传入的偏好列表或模型扫描出的点击组中查找
        const candidates = (preferredList.length > 0) ? preferredList : this.tapMotions;
        if (candidates.length > 0) {
            const played = this.playMotionFromCandidates(candidates);
            if (played) return;
        }

        // 若模型无点击动作，回退至特殊动作或任意可用动作
        if (this.specialMotions.length > 0) {
            this.playMotionFromCandidates(this.specialMotions);
        } else {
            this.triggerRandomMotion();
        }
    }

    /**
     * 2. 触发【拖拽组】动作 (用户按住并拖动桌宠窗口)
     */
    triggerDragMotion(preferredList = []) {
        if (!this.model || !this.isLoaded || this.isSleeping) return;
        this.isDragging = true;

        const now = Date.now();
        if (now - this.lastMotionTriggerTime < 800) return; // 800ms 防抖
        this.lastMotionTriggerTime = now;

        console.log("[SOULLINK LIVE2D] 触发【拖拽组】动作交互");

        const candidates = (preferredList.length > 0) ? preferredList : this.dragMotions;
        if (candidates.length > 0) {
            const played = this.playMotionFromCandidates(candidates);
            if (played) return;
        }

        // 若无拖拽动作，尝试点击动作或惊吓微姿态
        if (this.tapMotions.length > 0) {
            this.playMotionFromCandidates(this.tapMotions);
        }
    }

    /**
     * 3. 触发【特殊组】动作 (日常待机自发产生的小动作 / 施法 / 舞蹈 / 招牌姿态)
     */
    triggerSpecialMotion(preferredList = []) {
        if (!this.model || !this.isLoaded) return;
        if (this.isSleeping || this.isSpeaking || this.isDragging) return;

        console.log("[SOULLINK LIVE2D] 触发【特殊组】待机自发动作");

        const candidates = (preferredList.length > 0) ? preferredList : this.specialMotions;
        if (candidates.length > 0) {
            const played = this.playMotionFromCandidates(candidates);
            if (played) return;
        }

        // 若无特殊动作，尝试任意非 Idle 动作
        const nonIdle = this.allMotionGroups.filter(g => !this.idleMotions.includes(g));
        if (nonIdle.length > 0) {
            this.playMotionFromCandidates(nonIdle);
        }
    }

    /**
     * 4. 触发【待机组】动作 (恢复平稳站姿与呼吸循环)
     */
    triggerIdleMotion() {
        if (!this.model || !this.isLoaded) return;
        this.isDragging = false;

        if (this.idleMotions.length > 0) {
            this.playMotionFromCandidates(this.idleMotions);
        } else {
            try {
                this.model.motion('');
            } catch (e) {}
        }
    }

    /**
     * 辅助：在指定候选动作组列表中随机抽取一个并播放
     */
    playMotionFromCandidates(candidateList = []) {
        if (!this.model || !this.model.internalModel) return false;
        const motionManager = this.model.internalModel.motionManager;
        if (!motionManager || !motionManager.definitions) return false;

        const available = Object.keys(motionManager.definitions);
        const matched = candidateList.filter(grp => available.includes(grp));

        if (matched.length > 0) {
            const chosen = matched[Math.floor(Math.random() * matched.length)];
            try {
                this.model.motion(chosen);
                this.lastMotionTriggerTime = Date.now();
                return true;
            } catch (e) {
                console.warn(`[SOULLINK LIVE2D] 播放动作 ${chosen} 失败:`, e);
            }
        }
        return false;
    }

    /**
     * 启动日常待机自发动作调度器 (每 25~45 秒随机触发一次特殊小动作)
     */
    startIdleMotionScheduler() {
        this.stopIdleMotionScheduler();
        if (this.isSleeping) return; // 睡觉状态严格静默

        const nextDelay = 25000 + Math.random() * 20000; // 25s ~ 45s
        this.idleMotionTimer = setTimeout(() => {
            if (this.isLoaded && !this.isSleeping && !this.isSpeaking && !this.isDragging) {
                this.triggerSpecialMotion();
            }
            this.startIdleMotionScheduler(); // 递归安排下一次
        }, nextDelay);
    }

    /**
     * 停止待机自发动作调度器
     */
    stopIdleMotionScheduler() {
        if (this.idleMotionTimer) {
            clearTimeout(this.idleMotionTimer);
            this.idleMotionTimer = null;
        }
    }

    /**
     * 随机触发可用的动作 Motion (通用保底)
     */
    triggerRandomMotion(candidateGroups = []) {
        if (!this.model || !this.model.internalModel || this.isSleeping) return;
        const motionManager = this.model.internalModel.motionManager;
        if (!motionManager || !motionManager.definitions) return;

        const availableGroups = Object.keys(motionManager.definitions);
        if (availableGroups.length === 0) return;

        // 如果指定了候选组，优先在候选组里找
        for (const grp of candidateGroups) {
            if (availableGroups.includes(grp)) {
                try {
                    this.model.motion(grp);
                    this.lastMotionTriggerTime = Date.now();
                    return;
                } catch (e) {}
            }
        }

        // 随机在所有动作组中播放
        const randomGrp = availableGroups[Math.floor(Math.random() * availableGroups.length)];
        try {
            this.model.motion(randomGrp);
            this.lastMotionTriggerTime = Date.now();
        } catch (e) {}
    }

    destroy() {
        this.stopIdleMotionScheduler();
        this.isSpeaking = false;
        this.isSleeping = false;
        this.isDragging = false;
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
        this.rawModelWidth = 0;
        this.rawModelHeight = 0;
    }
}

// 挂载全局单例
window.SoullinkLive2D = new SoullinkLive2DDriver();
