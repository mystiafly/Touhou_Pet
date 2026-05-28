class RumiaPet {
    constructor() {
        this.input = document.getElementById('pet-input');
        this.bubble = document.getElementById('speech-bubble');
        this.bubbleContent = document.getElementById('bubble-content');
        this.img = document.getElementById('rumia-img');
        this.favScore = document.getElementById('fav-score');
        this.favContainer = document.getElementById('fav-container');





        // [新增] 图片映射表
        this.images = {
            'normal': '/static/images/rumia_normal.png',
            'angry':  '/static/images/rumia_angry.png',
            'shy':    '/static/images/rumia_shy.png',
            'crying': '/static/images/rumia_crying.png'
        };

        // [新增] 预加载图片 (防止切换时闪烁)
        this.preloadImages();

        this.autoSpeakTimer = null;
        this.autoSpeakCount = 0;

        this.init();
    }

    preloadImages() {
        Object.values(this.images).forEach(src => {
            const img = new Image();
            img.src = src;
        });
    }

    init() {
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        this.initSettings();

        this.resetAutoSpeakTimer();

        // 点击身体互动（可选：点击变害羞）
        this.img.addEventListener('click', () => {
            // this.setEmotion('shy');
        });

        this.loadStatus();

        // [新增] 动态忽略鼠标事件与JS拖拽窗口支持（解决 -webkit-app-region: drag 拦截 DOM 鼠标事件的 Bug）
        const { ipcRenderer } = window.require ? window.require('electron') : {};
        if (ipcRenderer) {
            let isDragging = false;
            let startX = 0, startY = 0;

            // 监听露米娅图片上的 mousedown 开始拖动
            this.img.addEventListener('mousedown', (e) => {
                if (e.button === 0) { // 只有鼠标左键点击才允许拖拽
                    isDragging = true;
                    startX = e.screenX;
                    startY = e.screenY;
                    // 开始拖动时强行捕获鼠标，不忽略事件
                    ipcRenderer.send('set-ignore-mouse-events', false);
                    this.img.style.cursor = 'grabbing';
                }
            });

            // 阻止浏览器原生的图片拖拽行为（防止拉出虚影且 mouseup 无法触发的问题）
            this.img.addEventListener('dragstart', (e) => {
                e.preventDefault();
            });

            // 监听全局 mousemove 事件，处理拖拽计算和穿透检测
            window.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    const deltaX = e.screenX - startX;
                    const deltaY = e.screenY - startY;
                    startX = e.screenX;
                    startY = e.screenY;
                    // 发送拖拽位移给主进程移动整个窗口
                    ipcRenderer.send('window-drag', { deltaX, deltaY });
                } else {
                    // 处于非拖拽的正常悬停状态下，进行点击穿透检测
                    let isInteractive = false;
                    const el = e.target;
                    if (el) {
                        if (
                            el.id === 'rumia-img' ||
                            el.closest('.input-bar') ||
                            el.closest('.settings-content') ||
                            el.closest('.fav-container') ||
                            (el.closest('#speech-bubble') && this.bubble.style.opacity === '1')
                        ) {
                            isInteractive = true;
                        }
                    }
                    
                    if (isInteractive) {
                        // 悬浮在角色/输入栏上时，激活点击
                        ipcRenderer.send('set-ignore-mouse-events', false);
                    } else {
                        // 悬浮在背景空白处时，启用鼠标点击穿透（透明区域点击透过窗口到桌面）
                        ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
                    }
                }
            });

            // 全局监听 mouseup 停止拖动
            window.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    this.img.style.cursor = 'grab';
                }
            });
        }

        setTimeout(() => this.greetUser(), 500);
    }

    initSettings() {
        this.settingsBtn = document.getElementById('settings-btn');
        this.settingsModal = document.getElementById('settings-modal');
        this.closeSettingsBtn = document.getElementById('close-settings-btn');
        this.exitGameBtn = document.getElementById('exit-game-btn');
        this.apiSelect = document.getElementById('api-provider-select');

        // [新增] 日志与大脑引擎查看面板 DOM 引用
        this.settingsContent = this.settingsModal.querySelector('.settings-content');
        this.mainView = document.getElementById('settings-main-view');
        this.engineView = document.getElementById('settings-engine-view');
        this.logsView = document.getElementById('settings-logs-view');
        this.graphView = document.getElementById('settings-graph-view'); // [新增]
        
        this.openEngineBtn = document.getElementById('open-engine-btn');
        this.backEngineBtn = document.getElementById('back-engine-btn');
        this.openLogsBtn = document.getElementById('open-logs-btn');
        this.backSettingsBtn = document.getElementById('back-settings-btn');
        this.logDateSelect = document.getElementById('log-date-select');
        this.logContentArea = document.getElementById('log-content-area');
        
        this.openGraphBtn = document.getElementById('open-graph-btn'); // [新增]
        this.backGraphBtn = document.getElementById('back-graph-btn'); // [新增]
        this.manualDistillBtn = document.getElementById('manual-distill-btn'); // [新增]
        this.seedTestBtn = document.getElementById('seed-test-btn'); // [新增]

        // 打开菜单
        this.settingsBtn.addEventListener('click', async () => {
            this.settingsModal.classList.remove('hidden');
            await this.loadConfig();
        });

        // 关闭菜单
        this.closeSettingsBtn.addEventListener('click', () => {
            this.closeSettingsModal();
        });

        // 点击背景关闭
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.closeSettingsModal();
            }
        });

        // 监听引擎切换事件
        this.apiSelect.addEventListener('change', () => this.saveConfig());

        // 退出游戏
        this.exitGameBtn.addEventListener('click', () => this.exitGame());

        // [新增] 切换到大脑引擎面板
        this.openEngineBtn.addEventListener('click', () => {
            this.mainView.classList.add('hidden');
            this.engineView.classList.remove('hidden');
        });

        // [新增] 返回主设置面板 (大脑引擎)
        this.backEngineBtn.addEventListener('click', () => {
            this.engineView.classList.add('hidden');
            this.mainView.classList.remove('hidden');
        });

        // [新增] 切换到日志面板
        this.openLogsBtn.addEventListener('click', () => {
            this.mainView.classList.add('hidden');
            this.logsView.classList.remove('hidden');
            this.settingsContent.classList.add('wide');
            this.loadLogsList();
        });

        // [新增] 返回主设置面板 (日记)
        this.backSettingsBtn.addEventListener('click', () => {
            this.logsView.classList.add('hidden');
            this.mainView.classList.remove('hidden');
            this.settingsContent.classList.remove('wide');
        });

        // [新增] 切换到图谱面板
        this.openGraphBtn.addEventListener('click', () => {
            this.mainView.classList.add('hidden');
            this.graphView.classList.remove('hidden');
            this.settingsContent.classList.add('wide');
            this.loadMemoryGraph();
        });

        // [新增] 返回主设置面板 (图谱)
        this.backGraphBtn.addEventListener('click', () => {
            this.graphView.classList.add('hidden');
            this.mainView.classList.remove('hidden');
            this.settingsContent.classList.remove('wide');
        });

        // [新增] 手动整理与测试注入事件监听
        this.manualDistillBtn.addEventListener('click', () => this.manualDistill(false));
        this.seedTestBtn.addEventListener('click', () => this.manualDistill(true));

        // [新增] 日期选择切换
        this.logDateSelect.addEventListener('change', () => {
            this.loadLogContent();
        });
    }

    // [新增] 辅助关闭方法，用于重置状态
    closeSettingsModal() {
        this.settingsModal.classList.add('hidden');
        // 重置视图回主界面，防止下次点开是大框
        setTimeout(() => {
            this.logsView.classList.add('hidden');
            this.engineView.classList.add('hidden');
            this.graphView.classList.add('hidden'); // [新增]
            this.mainView.classList.remove('hidden');
            this.settingsContent.classList.remove('wide');
            this.logDateSelect.innerHTML = '<option value="">暂无记录...</option>';
            this.logContentArea.innerText = '请选择一个日期来查阅你和露米娅的聊天回忆...';
            
            // [新增] 销毁图谱
            if (this.network) {
                this.network.destroy();
                this.network = null;
            }
            const infoCard = document.getElementById('graph-info-card');
            if (infoCard) infoCard.classList.add('hidden');
        }, 300);
    }

    // [新增] 加载所有可用的日志日期列表
    async loadLogsList() {
        this.logDateSelect.innerHTML = '<option value="">加载中...</option>';
        try {
            const response = await fetch('/api/settings/logs');
            const data = await response.json();
            if (data.success && data.dates && data.dates.length > 0) {
                let html = '<option value="">-- 请选择日期 --</option>';
                data.dates.forEach(date => {
                    html += `<option value="${date}">${date}</option>`;
                });
                this.logDateSelect.innerHTML = html;
            } else {
                this.logDateSelect.innerHTML = '<option value="">暂无聊天记录</option>';
                this.logContentArea.innerText = '还没有任何每日回忆记录哦，快去和露米娅多聊聊吧！';
            }
        } catch (e) {
            console.error("加载日志列表失败:", e);
            this.logDateSelect.innerHTML = '<option value="">加载失败</option>';
        }
    }

    // [新增] 加载并渲染特定日期的日志内容
    async loadLogContent() {
        const val = this.logDateSelect.value;
        if (!val) {
            this.logContentArea.innerText = '请选择一个日期来查阅你和露米娅的聊天回忆...';
            return;
        }

        this.logContentArea.innerText = '正在读取回忆中...';
        try {
            const response = await fetch(`/api/settings/logs/${val}`);
            const data = await response.json();
            if (data.success && data.content) {
                this.logContentArea.innerText = data.content;
                // 滚动到底部，方便查看当天的最新聊天
                setTimeout(() => {
                    const wrapper = this.logContentArea.parentElement;
                    wrapper.scrollTop = wrapper.scrollHeight;
                }, 50);
            } else {
                this.logContentArea.innerText = `读取回忆失败: ${data.error || '未知错误'}`;
            }
        } catch (e) {
            console.error("加载日志内容失败:", e);
            this.logContentArea.innerText = '加载回忆失败，请稍后重试。';
        }
    }

    async loadConfig() {
        try {
            const response = await fetch('/api/settings/config');
            const data = await response.json();
            if (data.success) {
                this.apiSelect.value = data.api_provider;
                
                // 动态给下拉框添加密钥说明
                const geminiOption = this.apiSelect.querySelector('option[value="gemini"]');
                const dsFlashOption = this.apiSelect.querySelector('option[value="deepseek-v4-flash"]');
                const dsProOption = this.apiSelect.querySelector('option[value="deepseek-v4-pro"]');
                const dsChatOption = this.apiSelect.querySelector('option[value="deepseek-chat"]');
                
                if (geminiOption) {
                    geminiOption.innerText = data.has_gemini ? "Gemini 2.5 (检测到 Key)" : "Gemini 2.5 (未检测到 Key)";
                }
                if (dsFlashOption) {
                    dsFlashOption.innerText = data.has_deepseek ? "DeepSeek V4 Flash (检测到 Key)" : "DeepSeek V4 Flash (未检测到 Key)";
                }
                if (dsProOption) {
                    dsProOption.innerText = data.has_deepseek ? "DeepSeek V4 Pro (检测到 Key)" : "DeepSeek V4 Pro (未检测到 Key)";
                }
                if (dsChatOption) {
                    dsChatOption.innerText = data.has_deepseek ? "DeepSeek V3 标准版 (检测到 Key)" : "DeepSeek V3 标准版 (未检测到 Key)";
                }
            }
        } catch (e) {
            console.error("加载配置失败:", e);
        }
    }

    async saveConfig() {
        const val = this.apiSelect.value;
        try {
            const response = await fetch('/api/settings/config', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ api_provider: val })
            });
            const data = await response.json();
            if (data.success) {
                this.showBubble(`我的大脑已成功切换为 ${val.toUpperCase()} 引擎！`, 2000);
            }
        } catch (e) {
            console.error("保存配置失败:", e);
            this.showBubble("切换引擎失败...", 2000);
        }
    }

    async exitGame() {
        if (!confirm("要让露米娅去睡觉吗？")) return;

        this.showBubble("那...晚安啰...", 2000);
        this.setEmotion('normal'); // 或者 sleeping 图
        this.settingsModal.classList.add('hidden');

        try {
            const response = await fetch('/api/settings/exit', {
                method: 'POST'
            });
            const data = await response.json();

            if (data.success) {
                // 后端会在1秒后自杀，前端可以尝试关闭窗口
                setTimeout(() => {
                    window.close(); // 尝试关闭浏览器窗口
                }, 1000);
            }
        } catch (e) {
            console.error("退出失败:", e);
            // 如果后端已经死了，fetch 可能会报错，这也算成功退出了
            setTimeout(() => window.close(), 1000);
        }
    }
    // [新增] 切换表情的核心函数
    setEmotion(emotion) {
        // 如果后端传来的心情不在列表里，默认用 normal
        // 比如后端可能返回 "happy" 但我们只有 "normal"，就回退到 normal
        const targetSrc = this.images[emotion] || this.images['normal'];

        // 如果当前已经是这张图，就不操作了，避免闪烁
        if (this.img.src.includes(targetSrc)) return;

        console.log(`切换心情: ${emotion}`);

        // 简单的淡入淡出效果
        this.img.style.opacity = '0.7';
        setTimeout(() => {
            this.img.src = targetSrc;
            this.img.style.opacity = '1';
        }, 150);
    }

// [修改] 显示气泡 (duration 如果不传或传 null，则自动计算)
    showBubble(text, duration = null) {
        this.bubbleContent.innerText = text;
        this.bubble.style.opacity = '1';
        this.bubble.style.pointerEvents = 'auto'; // 说话时启用鼠标交互（允许滚动、选择文本）

        if (this.bubbleTimer) clearTimeout(this.bubbleTimer);

        // [新增] 智能时长计算逻辑
        let showTime = duration;
        if (!showTime) {
            // 基础时间 3秒 + 每个字 0.3秒
            // 例如：10个字 = 3+3 = 6秒
            // 50个字 = 3+15 = 18秒
            const calcTime = 3000 + (text.length * 300);

            // 限制最长不超过 30秒 (防止显示太久挡路)
            showTime = Math.min(calcTime, 30000);
        }

        console.log(`气泡显示时长: ${showTime/1000}秒 (字数: ${text.length})`);

        this.bubbleTimer = setTimeout(() => {
            this.bubble.style.opacity = '0';
            this.bubble.style.pointerEvents = 'none'; // 隐藏时完全穿透鼠标，防止挡住后面的东西
        }, showTime);
    }

    async sendMessage() {
        const text = this.input.value.trim();
        if (!text) return;

        this.input.value = '';
        this.autoSpeakCount = 0;
        this.resetAutoSpeakTimer();

        this.showBubble("hmm...");

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ message: text })
            });
            const data = await response.json();

            if (data.success) {
                // 1. 先显示对话 (这是最重要的，绝对不能被覆盖)
                this.showBubble(data.reply);
                this.setEmotion(data.emotion);

                // 2. 处理好感度 (不要再调用 showBubble 了！)
                if (data.favorability !== undefined) {
                    // 先更新显示的数值
                    this.favScore.innerText = data.favorability;

                    // 视觉反馈：在左上角数字旁边显示 (+1) 或 (-1)
                    if (data.fav_change > 0) {
                        // 变成类似 "61 (+1)" 的样子，用红色高亮
                        this.favScore.innerHTML = `${data.favorability} <span style="color: #ff3366; font-size: 14px; margin-left:5px;">(+1)</span>`;
                        // 2秒后恢复正常
                        setTimeout(() => this.favScore.innerText = data.favorability, 2000);

                    } else if (data.fav_change < 0) {
                        // 变成类似 "60 (-1)" 的样子，用灰色或蓝色
                        this.favScore.innerHTML = `${data.favorability} <span style="color: #888; font-size: 14px; margin-left:5px;">(-1)</span>`;
                        setTimeout(() => this.favScore.innerText = data.favorability, 2000);
                    }
                }
            }
        } catch (e) {
            this.showBubble("听不到... (网络错误)");
            this.setEmotion('crying');
        }
    }

    resetAutoSpeakTimer() {
        if (this.autoSpeakTimer) clearTimeout(this.autoSpeakTimer);
        if (this.autoSpeakCount >= 6) return;

        // 时间设置 (单位: 毫秒)
        // 正常使用建议用分钟: 2 * 60 * 1000
        let minTime = (this.autoSpeakCount < 3) ? 2 * 60 *1000 : 15 * 60 *1000;
        let maxTime = (this.autoSpeakCount < 3) ? 5 * 60 *1000 : 20 * 60 *1000;

        const delay = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
        this.autoSpeakTimer = setTimeout(() => this.triggerRumiaSpeak(), delay);
    }

    // [新增] 启动时打招呼
    async greetUser() {
        console.log("正在尝试打招呼...");
        // 先显示等待，提升体验
        this.showBubble("...", 2000);

        try {
            const response = await fetch('/api/rumia_speak', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                // 传参 type: 'greeting'
                body: JSON.stringify({ type: 'greeting', count: 0 })
            });
            const data = await response.json();
            if (data.success) {
                this.showBubble(data.reply);
                this.setEmotion(data.emotion);
                if (data.favorability !== undefined) {
                    this.favScore.innerText = data.favorability;
                }
            }
        } catch (e) {
            console.error("打招呼失败:", e);
        }
    }

    async triggerRumiaSpeak() {
        this.autoSpeakCount++;
        try {
            const response = await fetch('/api/rumia_speak', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ count: this.autoSpeakCount })
            });
            const data = await response.json();
            if (data.success) {
                this.showBubble(data.reply);
                this.setEmotion(data.emotion);
                if (data.favorability !== undefined) {
                    this.favScore.innerText = data.favorability;
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            this.resetAutoSpeakTimer();
        }
    }

    // [新增] 在类中添加这个新方法
    async loadStatus() {
        try {
            // 调用 get_history 接口，后端已经修改为会返回 favorability
            const response = await fetch('/api/history');
            const data = await response.json();

            if (data.favorability !== undefined) {
                this.favScore.innerText = data.favorability;
                console.log("初始好感度已加载:", data.favorability);
            }
        } catch (e) {
            console.error("加载状态失败", e);
        }
    }

    // [新增] 异步加载并渲染 Vis.js 记忆关系拓扑图
    async loadMemoryGraph() {
        const container = document.getElementById('graph-canvas-container');
        container.innerHTML = '<div style="color: #ff6b8b; text-align: center; padding-top: 80px; font-size:12px;"><i class="fas fa-spinner fa-spin"></i> 正在读取记忆图谱...</div>';
        
        // 初始隐藏卡片
        const infoCard = document.getElementById('graph-info-card');
        if (infoCard) infoCard.classList.add('hidden');
        
        try {
            const response = await fetch('/api/settings/memory_graph');
            const data = await response.json();
            
            if (!data.success) {
                container.innerHTML = `<div style="color: #ff3333; text-align: center; padding-top: 80px; font-size:12px;">读取失败: ${data.error}</div>`;
                return;
            }
            
            if (!data.nodes || data.nodes.length === 0) {
                container.innerHTML = `
                    <div style="color: #aaa; text-align: center; padding: 40px 15px 15px 15px; font-size:11px; line-height:1.5;">
                        <i class="fas fa-project-diagram" style="font-size: 24px; color: #ff6b8b; margin-bottom: 8px; display:block;"></i>
                        记忆图谱目前为空哦。<br>
                        快去和露米娅聊聊天，或点击上方“整理今日记忆”来提炼对话吧！
                    </div>
                `;
                return;
            }
            
            container.innerHTML = ''; // 清空容器
            
            const visNodes = new vis.DataSet(data.nodes);
            const visEdges = new vis.DataSet(data.edges);
            
            const graphData = {
                nodes: visNodes,
                edges: visEdges
            };
            
            const options = {
                physics: {
                    enabled: true,
                    solver: 'forceAtlas2Based',
                    forceAtlas2Based: {
                        gravitationalConstant: -26,
                        centralGravity: 0.01,
                        springLength: 80,
                        springConstant: 0.08,
                        damping: 0.4,
                        avoidOverlap: 0.5
                    },
                    stabilization: {
                        iterations: 150,
                        updateInterval: 25
                    }
                },
                interaction: {
                    hover: true,
                    dragNodes: true,
                    dragView: true,
                    zoomView: true
                },
                nodes: {
                    borderWidth: 1.5,
                    font: {
                        face: 'sans-serif',
                        strokeWidth: 2,
                        strokeColor: '#1e1e28'
                    }
                },
                edges: {
                    width: 1.5,
                    selectionWidth: 2.5,
                    hoverWidth: 2.5
                }
            };
            
            if (this.network) {
                this.network.destroy();
            }
            
            this.network = new vis.Network(container, graphData, options);
            
            // 绑定节点点击事件
            this.network.on("click", (params) => {
                if (params.nodes && params.nodes.length > 0) {
                    const nodeId = params.nodes[0];
                    const node = visNodes.get(nodeId);
                    
                    if (node) {
                        const titleEl = document.getElementById('info-node-title');
                        const contentEl = document.getElementById('info-node-content');
                        
                        if (node.type === 'fact') {
                            titleEl.innerHTML = `<i class="fas fa-book" style="color: #ff8da1;"></i> 露米娅的回忆事实`;
                            contentEl.innerText = node.full_text;
                        } else if (node.type === 'entity') {
                            titleEl.innerHTML = `<i class="fas fa-fingerprint" style="color: #8be9fd;"></i> 关联词/实体 (${node.entity_type})`;
                            contentEl.innerText = `这个词连接了露米娅对您的 “${node.label}” 的记忆碎片。`;
                        }
                        
                        infoCard.classList.remove('hidden');
                    }
                } else {
                    infoCard.classList.add('hidden');
                }
            });
            
        } catch (e) {
            console.error("加载记忆图谱异常:", e);
            container.innerHTML = '<div style="color: #ff3333; text-align: center; padding-top: 80px; font-size:12px;">读取错误，请重试。</div>';
        }
    }

    // [新增] 手动整理记忆与测试注入
    async manualDistill(seedTest = false) {
        const distillBtn = document.getElementById('manual-distill-btn');
        const seedBtn = document.getElementById('seed-test-btn');
        
        const originalText1 = distillBtn.innerHTML;
        const originalText2 = seedBtn.innerHTML;
        
        distillBtn.disabled = true;
        seedBtn.disabled = true;
        
        if (seedTest) {
            seedBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 注入中...';
        } else {
            distillBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 整理中...';
        }
        
        try {
            const response = await fetch('/api/settings/memory_distill_now', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ seed_test: seedTest })
            });
            const data = await response.json();
            
            if (data.success) {
                this.showBubble(data.message, 3500);
                // 重新加载图谱
                await this.loadMemoryGraph();
            } else {
                this.showBubble(data.error, 3500);
            }
        } catch (e) {
            console.error("手动整理记忆异常:", e);
            this.showBubble("露米娅现在整理不过来... (网络错误)", 3500);
        } finally {
            distillBtn.disabled = false;
            seedBtn.disabled = false;
            distillBtn.innerHTML = originalText1;
            seedBtn.innerHTML = originalText2;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new RumiaPet();
});
