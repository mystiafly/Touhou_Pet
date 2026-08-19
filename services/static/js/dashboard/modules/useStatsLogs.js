// useStatsLogs.js - 每日对话回忆日志、系统运行统计与 Chart.js 仪表盘模块
window.useStatsLogsModule = function(Vue) {
    const { ref, reactive, computed } = Vue;

    // 日志与回忆状态
    const logDates = ref([]);
    const selectedDate = ref('');
    const currentTab = ref('chat'); // 'chat' | 'diary'
    const chatContentRaw = ref('');
    const diaryContentRaw = ref('');
    const isLoadingLogs = ref(false);

    // 统计仪表盘状态
    const statsTotalTime = ref('0h 0m');
    const activityLogs = ref([]);
    let chartCharacterTime = null;
    let chartWeeklyUsage = null;
    let chartDailyDialogs = null;

    // 解析微信风格对话泡泡
    const parsedChatMessages = computed(() => {
        if (!chatContentRaw.value) return [];
        const lines = chatContentRaw.value.split('\n');
        const messages = [];
        let currentMsg = null;

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            const isNewEntry = /^\[\d{2}:\d{2}:\d{2}\]/.test(line);
            if (isNewEntry) {
                if (currentMsg) messages.push(currentMsg);
                const match = line.match(/^\[(.*?)\]\s+(.*?)(?::|：)\s*(.*)$/);
                if (match && !match[2].includes('[物理互动]') && !match[2].includes('[系统]')) {
                    const senderRaw = match[2];
                    const isUser = senderRaw.toLowerCase() === 'you' || senderRaw.toLowerCase().includes('you ') || senderRaw === '你' || senderRaw.toLowerCase() === 'user';
                    currentMsg = {
                        time: match[1],
                        sender: isUser ? '你' : senderRaw.replace(/\(.*?\)/g, '').trim(),
                        isUser,
                        content: match[3]
                    };
                } else {
                    currentMsg = null;
                }
            } else if (currentMsg) {
                currentMsg.content += '\n' + line;
            }
        }
        if (currentMsg) messages.push(currentMsg);
        return messages;
    });

    async function loadLogsList() {
        try {
            const res = await fetch('/api/settings/logs');
            const data = await res.json();
            if (data.success && data.dates) {
                logDates.value = data.dates;
                if (data.dates.length > 0 && !selectedDate.value) {
                    selectedDate.value = data.dates[0];
                    await loadLogForDate(data.dates[0]);
                }
            }
        } catch (e) {
            console.error('加载日志列表异常:', e);
        }
    }

    async function loadLogForDate(dateStr) {
        if (!dateStr) return;
        isLoadingLogs.value = true;
        try {
            const res = await fetch(`/api/settings/logs/${dateStr}`);
            const data = await res.json();
            if (data.success) {
                chatContentRaw.value = data.chat_content || '';
                diaryContentRaw.value = data.diary_content || '';
            }
        } catch (e) {
            console.error('读取日志内容异常:', e);
        } finally {
            isLoadingLogs.value = false;
        }
    }

    async function loadDashboardStats() {
        try {
            const res = await fetch('/api/settings/usage_stats');
            const data = await res.json();
            if (data.success && data.stats) {
                renderDashboardCharts(data.stats);
            }
        } catch (e) {
            console.error('加载统计数据异常:', e);
        }
    }

    function renderDashboardCharts(stats) {
        // 总运行时长
        const totalMinutes = stats.total_active_minutes || 0;
        const h = Math.floor(totalMinutes / 60);
        const m = Math.round(totalMinutes % 60);
        statsTotalTime.value = `${h}h ${m}m`;

        activityLogs.value = stats.recent_sessions || [];

        if (typeof Chart === 'undefined') return;

        // 1. 角色占比饼图
        const ctxPie = document.getElementById('chart-character-time');
        if (ctxPie && stats.character_times) {
            if (chartCharacterTime) chartCharacterTime.destroy();
            const labels = Object.keys(stats.character_times);
            const dataVals = Object.values(stats.character_times);
            chartCharacterTime = new Chart(ctxPie, {
                type: 'doughnut',
                data: {
                    labels,
                    datasets: [{
                        data: dataVals,
                        backgroundColor: ['#ff79c6', '#8be9fd', '#50fa7b', '#ffb86c', '#bd93f9', '#f1fa8c']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        // 2. 7 天活跃时长柱状图
        const ctxBar = document.getElementById('chart-weekly-usage');
        if (ctxBar && stats.weekly_minutes) {
            if (chartWeeklyUsage) chartWeeklyUsage.destroy();
            chartWeeklyUsage = new Chart(ctxBar, {
                type: 'bar',
                data: {
                    labels: Object.keys(stats.weekly_minutes),
                    datasets: [{
                        label: '分钟',
                        data: Object.values(stats.weekly_minutes),
                        backgroundColor: '#8be9fd'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        // 3. 对话活跃度折线图
        const ctxLine = document.getElementById('chart-daily-dialogs');
        if (ctxLine && stats.daily_dialogs) {
            if (chartDailyDialogs) chartDailyDialogs.destroy();
            chartDailyDialogs = new Chart(ctxLine, {
                type: 'line',
                data: {
                    labels: Object.keys(stats.daily_dialogs),
                    datasets: [{
                        label: '对话次数',
                        data: Object.values(stats.daily_dialogs),
                        borderColor: '#ff79c6',
                        tension: 0.3,
                        fill: false
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    }

    return {
        logDates,
        selectedDate,
        currentTab,
        chatContentRaw,
        diaryContentRaw,
        isLoadingLogs,
        statsTotalTime,
        activityLogs,
        parsedChatMessages,
        loadLogsList,
        loadLogForDate,
        loadDashboardStats
    };
};
