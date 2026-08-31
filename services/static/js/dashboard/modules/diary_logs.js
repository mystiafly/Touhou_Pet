document.addEventListener('DOMContentLoaded', () => {
    // ========== 日常模式：图表和聊天记录相关逻辑 ==========
    const previewBtn = document.getElementById('preview-prompt-btn');
    const previewModal = document.getElementById('preview-modal');
    const closePreviewBtn = document.getElementById('close-preview-btn');
    const previewLoading = document.getElementById('preview-loading');
    
    // Tab contents
    const previewContentPre = document.getElementById('preview-content-area-pre');
    const previewContentMain = document.getElementById('preview-content-area-main');
    const previewContentPost = document.getElementById('preview-content-area-post');
    const tabBtns = document.querySelectorAll('#preview-modal .tab-btn');
    const tabContents = document.querySelectorAll('#preview-modal .tab-content');

    let currentPreviewData = null;

    // Tab switching logic
    if (tabBtns) {
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                const targetId = btn.getAttribute('data-target');
                document.getElementById(targetId).classList.add('active');
            });
        });
    }

    function formatMessages(messages, hideHistory) {
        if (!messages) return "";
        let html = "";
        messages.forEach(msg => {
            if (hideHistory && msg.is_history) return;
            html += `${msg.role_name}\n${msg.content}\n\n=======================================================================\n\n`;
        });
        return html;
    }

    function renderPreview() {
        const hideHistory = document.getElementById('hide-history-toggle') ? document.getElementById('hide-history-toggle').checked : false;
        if (!currentPreviewData) return;
        
        if (previewContentPre) previewContentPre.innerText = formatMessages(currentPreviewData.pre_messages, hideHistory);
        if (previewContentMain) previewContentMain.innerText = formatMessages(currentPreviewData.main_messages, hideHistory);
        if (previewContentPost) previewContentPost.innerText = formatMessages(currentPreviewData.post_messages, hideHistory);
    }

    if (document.getElementById('hide-history-toggle')) {
        document.getElementById('hide-history-toggle').addEventListener('change', renderPreview);
    }

    if (previewBtn) {
        previewBtn.addEventListener('click', async () => {
            previewModal.classList.remove('hidden');
            if (previewContentPre) previewContentPre.innerText = '';
            if (previewContentMain) previewContentMain.innerText = '';
            if (previewContentPost) previewContentPost.innerText = '';
            previewLoading.classList.remove('hidden');

            try {
                const response = await fetch('/api/settings/preview_prompt');
                const data = await response.json();
                previewLoading.classList.add('hidden');
                
                if (data.success) {
                    currentPreviewData = data;
                    renderPreview();
                } else {
                    if (previewContentMain) previewContentMain.innerText = `生成失败: ${data.error || '未知错误'}`;
                }
            } catch (e) {
                console.error(e);
                previewLoading.classList.add('hidden');
                if (previewContentMain) previewContentMain.innerText = "请求失败，请检查后端运行状态。";
            }
        });
    }

    if (closePreviewBtn) {
        closePreviewBtn.addEventListener('click', () => {
            previewModal.classList.add('hidden');
        });
    }

    // 点击模态框背景关闭
    previewModal.addEventListener('click', (e) => {
        if (e.target === previewModal) {
            previewModal.classList.add('hidden');
        }
    });

    // ========== 重启应用 ==========
    const restartBtn = document.getElementById('restart-app-btn');
    if (restartBtn) {
        restartBtn.addEventListener('click', async () => {
            const confirmRestart = await window.asyncConfirm("确定要重新启动大贤者系统吗？\n如果程序没有自动打开，请手动双击启动！");
            if (confirmRestart) {
                if (typeof require !== 'undefined') {
                    const { ipcRenderer } = require('electron');
                    ipcRenderer.send('restart-app');
                } else {
                    alert("当前非 Electron 环境，请手动重启");
                }
            }
        });
    }

    // ========== 每日回忆 (日记) ==========
    const logDateSelect = document.getElementById('log-date-select');
    const logContentArea = document.getElementById('log-content-area');
    const subtabChat = document.getElementById('subtab-chat');
    const subtabDiary = document.getElementById('subtab-diary');
    const rewriteDiaryBtn = document.getElementById('rewrite-diary-btn');

    let currentChatLog = "";
    let currentDiary = "";

    async function loadLogsList() {
        logDateSelect.innerHTML = '<option value="">加载中...</option>';
        try {
            const response = await fetch('/api/settings/logs');
            const data = await response.json();
            if (data.success && data.dates && data.dates.length > 0) {
                logDateSelect.innerHTML = '';
                data.dates.forEach(date => {
                    const opt = document.createElement('option');
                    opt.value = date;
                    opt.innerText = date;
                    logDateSelect.appendChild(opt);
                });
            } else {
                logDateSelect.innerHTML = '<option value="">暂无记录</option>';
            }
        } catch (e) {
            logDateSelect.innerHTML = '<option value="">加载失败</option>';
        }
    }

    logDateSelect.addEventListener('change', async () => {
        const val = logDateSelect.value;
        if (!val) return;

        logContentArea.innerText = '正在读取回忆中...';
        try {
            const response = await fetch(`/api/settings/logs/${val}`);
            const data = await response.json();
            if (data.success) {
                currentChatLog = data.chat_content || "";
                currentDiary = data.diary_content || "";
                switchLogTab('chat');
                rewriteDiaryBtn.style.display = 'inline-flex';
            } else {
                logContentArea.innerText = `读取回忆失败: ${data.error || '未知错误'}`;
                rewriteDiaryBtn.style.display = 'none';
            }
        } catch (e) {
            logContentArea.innerText = '加载回忆失败，请稍后重试。';
        }
    });

    function renderWechatStyleLog(logText) {
        const container = document.createElement('div');
        container.className = 'wechat-chat-container';
        
        const lines = logText.split('\n');
        let lastTime = '';
        let currentMsg = null;

        const flushMsg = () => {
            if (!currentMsg) return;
            const timeStr = currentMsg.time.substring(0, 5); // HH:MM
            if (timeStr !== lastTime) {
                const timeDiv = document.createElement('div');
                timeDiv.className = 'wechat-timestamp';
                timeDiv.textContent = timeStr;
                container.appendChild(timeDiv);
                lastTime = timeStr;
            }
            
            const isUser = currentMsg.sender.toLowerCase() === 'you' || currentMsg.sender.toLowerCase().includes('you ') || currentMsg.sender === '你' || currentMsg.sender.toLowerCase() === 'user';
            
            const row = document.createElement('div');
            row.className = 'wechat-msg-row ' + (isUser ? 'is-user' : 'is-bot');
            
            const avatar = document.createElement('div');
            avatar.className = 'wechat-avatar';
            if (isUser) {
                avatar.innerHTML = '<i class="fas fa-user" style="color:#282a36; font-size:20px; line-height:36px; text-align:center; width:100%;"></i>';
                avatar.style.background = '#50fa7b';
            } else {
                avatar.innerHTML = '<i class="fas fa-robot" style="color:#f8f8f2; font-size:20px; line-height:36px; text-align:center; width:100%;"></i>';
                avatar.style.background = '#6272a4';
            }
            
            const msgContent = document.createElement('div');
            msgContent.className = 'wechat-msg-content';
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'wechat-sender-name';
            nameDiv.textContent = isUser ? '你' : currentMsg.sender.replace(/\(.*?\)/g, '').trim();
            
            const bubble = document.createElement('div');
            bubble.className = 'wechat-bubble';
            bubble.innerHTML = currentMsg.content.replace(/\n/g, '<br>');
            
            msgContent.appendChild(nameDiv);
            msgContent.appendChild(bubble);
            
            row.appendChild(avatar);
            row.appendChild(msgContent);
            
            container.appendChild(row);
            currentMsg = null;
        };
        
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            
            const isNewEntry = /^\[\d{2}:\d{2}:\d{2}\]/.test(line);
            
            if (isNewEntry) {
                flushMsg();
                
                const match = line.match(/^\[(.*?)\]\s+(.*?)(?::|：)\s*(.*)$/);
                if (match && !match[2].includes('[物理互动]') && !match[2].includes('[系统]')) {
                    currentMsg = {
                        time: match[1],
                        sender: match[2].trim(),
                        content: match[3]
                    };
                } else {
                    const sysMsg = document.createElement('div');
                    sysMsg.className = 'wechat-timestamp';
                    sysMsg.textContent = line;
                    container.appendChild(sysMsg);
                }
            } else {
                if (currentMsg) {
                    currentMsg.content += '\n' + line;
                } else {
                    const sysMsg = document.createElement('div');
                    sysMsg.className = 'wechat-timestamp';
                    sysMsg.textContent = line;
                    container.appendChild(sysMsg);
                }
            }
        }
        flushMsg();
        
        return container;
    }

    function switchLogTab(tab) {
        if (tab === 'chat') {
            subtabChat.classList.add('active');
            subtabDiary.classList.remove('active');
            if (!currentChatLog) {
                logContentArea.innerText = "今天没有聊天对话记录哦。";
            } else {
                logContentArea.innerHTML = '';
                logContentArea.appendChild(renderWechatStyleLog(currentChatLog));
            }
            logContentArea.scrollTop = logContentArea.scrollHeight;
        } else {
            subtabChat.classList.remove('active');
            subtabDiary.classList.add('active');
            logContentArea.innerText = currentDiary || "今天没有写日记哦……";
            logContentArea.scrollTop = 0;
        }
    }

    subtabChat.addEventListener('click', () => switchLogTab('chat'));
    subtabDiary.addEventListener('click', () => switchLogTab('diary'));

    rewriteDiaryBtn.addEventListener('click', async () => {
        const val = logDateSelect.value;
        if (!val) return;
        if (!await window.asyncConfirm(`确定要重写 ${val} 的日记吗？`)) return;

        rewriteDiaryBtn.disabled = true;
        const oldHtml = rewriteDiaryBtn.innerHTML;
        rewriteDiaryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 重写中...';
        currentDiary = "正在努力重写日记中，请稍候...";
        switchLogTab('diary');

        try {
            const response = await fetch(`/api/settings/logs/${val}/rewrite`, { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                currentDiary = data.diary_content || "";
                switchLogTab('diary');
                alert("日记重写完成！");
            } else {
                alert(`重写失败: ${data.error}`);
            }
        } catch (e) {
            alert("请求失败！");
        } finally {
            rewriteDiaryBtn.disabled = false;
            rewriteDiaryBtn.innerHTML = oldHtml;
        }
    });


});
