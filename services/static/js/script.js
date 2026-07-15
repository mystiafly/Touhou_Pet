// static/js/script.js - 前端交互逻辑
class DesktopPetChat {
    constructor() {
        this.messageInput = document.getElementById('message-input');
        this.sendButton = document.getElementById('send-btn');
        this.chatHistory = document.getElementById('chat-history');
        this.clearButton = document.getElementById('clear-btn');
        this.historyCount = document.getElementById('history-count');
        this.loading = document.getElementById('loading');
        this.autoSpeakTimer = null;
        this.autoSpeakCount = 0;

        this.init();
    }

    init() {
        // 绑定事件
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.clearButton.addEventListener('click', () => this.clearHistory());

        // 加载历史
        this.loadHistory();

        // 自动聚焦输入框
        this.messageInput.focus();
        this.resetAutoSpeakTimer();
    }

    async loadHistory() {
        try {
            const response = await fetch('/api/history');
            const data = await response.json();

            // 更新历史计数
            this.historyCount.textContent = data.history.length;

            // 清空现有消息（除了欢迎消息）
            const welcomeMessage = this.chatHistory.querySelector('.welcome-message');
            this.chatHistory.innerHTML = '';
            if (welcomeMessage) {
                this.chatHistory.appendChild(welcomeMessage);
            }

            // 添加历史消息
            data.history.forEach(msg => this.addMessage(msg.role, msg.content, false));

            // 滚动到底部
            this.scrollToBottom();
        } catch (error) {
            console.error('加载历史失败:', error);
        }
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;

        this.autoSpeakCount = 0;
        this.resetAutoSpeakTimer();

        // 显示用户消息
        this.addMessage('你', message, true);

        // 清空输入框
        this.messageInput.value = '';

        // 显示加载动画
        this.showLoading(true);

        this.resetAutoSpeakTimer();
        try {
            // 发送到服务器
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            const data = await response.json();

            if (data.success) {
                // 显示AI回复
                this.addMessage('露米娅', data.reply, true);
                // 更新历史计数
                this.historyCount.textContent = data.history_count;
                this.resetAutoSpeakTimer();
            } else {
                this.addMessage('系统', data.error || '发送失败', false);
            }
            if (data.success) {
                // ...
                // [新增] AI 回复后，也重置计时器，开始新一轮等待
                this.resetAutoSpeakTimer();
            }

        } catch (error) {
            this.addMessage('系统', '网络错误: ' + error.message, false);
        } finally {
            this.showLoading(false);
            this.messageInput.focus();
        }
    }

    addMessage(sender, content, isNew = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender === '你' ? 'user-message' : 'ai-message'}`;

        const time = this.getCurrentTime();

        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${sender}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-content">${this.escapeHtml(content)}</div>
        `;

        this.chatHistory.appendChild(messageDiv);

        if (isNew) {
            this.scrollToBottom();
        }
    }

    async clearHistory() {
        if (!confirm('确定要清空所有对话历史吗？')) return;

        try {
            const response = await fetch('/api/clear', {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                // 清空聊天显示（保留欢迎消息）
                const welcomeMessage = this.chatHistory.querySelector('.welcome-message');
                this.chatHistory.innerHTML = '';
                if (welcomeMessage) {
                    this.chatHistory.appendChild(welcomeMessage);
                }

                // 重置计数
                this.historyCount.textContent = '0';

                // 显示确认消息
                this.addMessage('系统', '对话历史已清空', true);
            }
        } catch (error) {
            console.error('清空历史失败:', error);
        }
    }

    showLoading(show) {
        this.loading.style.display = show ? 'flex' : 'none';
    }

    scrollToBottom() {
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    }

    getCurrentTime() {
        const now = new Date();
        return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // [新增] 重置计时器：每次对话后重新开始倒数
    // [修改] 重置计时器：根据次数动态决定间隔
    resetAutoSpeakTimer() {
        if (this.autoSpeakTimer) {
            clearTimeout(this.autoSpeakTimer);
        }

        // 如果已经自言自语超过6次，她就去睡觉了，不再启动计时器
        if (this.autoSpeakCount >= 6) {
            console.log("露米娅生气去睡觉了，停止主动说话。");
            return;
        }

        let minTime, maxTime;

        // 逻辑判断
        if (this.autoSpeakCount < 3) {
            // 第 1, 2, 3 次 (计数器是0, 1, 2)：间隔几分钟 (例如 2-5 分钟)
            console.log(`第 ${this.autoSpeakCount + 1} 次尝试说话 (短间隔)`);
            minTime = 2 * 60 * 1000; // 2分钟
            maxTime = 5 * 60 * 1000; // 5分钟
        } else {
            // 第 4, 5, 6 次：间隔十几分钟 (例如 15-20 分钟)
            console.log(`第 ${this.autoSpeakCount + 1} 次尝试说话 (长间隔 - 生气/等待)`);
            minTime = 15 * 60 * 1000; // 15分钟
            maxTime = 20 * 60 * 1000; // 20分钟
        }

        // 生成随机时间
        const randomDelay = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;

        // 开发调试用：如果你想快速测试效果，把上面的 * 60 * 1000 改成 * 1000 (秒)
        console.log(`露米娅将在 ${Math.floor(randomDelay/1000)} 秒后主动说话`);

        this.autoSpeakTimer = setTimeout(() => {
            this.triggerPetSpeak();
        }, randomDelay);
    }

    // [新增] 触发主动说话请求
    // [修改] 触发主动说话请求
    async triggerPetSpeak() {
        try {
            // 计数器 +1
            this.autoSpeakCount++;

            // 发送请求，带上当前的次数 count
            const response = await fetch('/api/pet_speak', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json' // 必须加这个头
                },
                body: JSON.stringify({ count: this.autoSpeakCount }) // 传给后端
            });

            const data = await response.json();

            if (data.success) {
                this.addMessage('露米娅', data.reply, true);
                this.historyCount.textContent = data.history_count;
            }
        } catch (error) {
            console.error('露米娅尝试说话失败:', error);
        } finally {
            // 无论成功失败，继续下一次计时（除非已经在 resetAutoSpeakTimer 里判断超过6次）
            this.resetAutoSpeakTimer();
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new DesktopPetChat();
});
