// ==================== DASHBOARD STATS LOGIC ====================
let chartsInstances = {};

async function loadDashboardStats() {
    try {
        const res = await fetch('/api/stats/dashboard');
        const data = await res.json();
        if (data.status === 'success') {
            renderDashboardStats(data.data);
        }
    } catch (e) {
        console.error("Failed to load dashboard stats", e);
    }
}

function renderDashboardStats(stats) {
    // 1. Total Time
    const totalMin = Math.floor(stats.total_time / 60);
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    document.getElementById('stats-total-time').textContent = `${hours}h ${mins}m`;

    // Shared Chart Options
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: '#f8f8f2', font: { family: 'monospace' } } },
            tooltip: { backgroundColor: 'rgba(40,42,54,0.9)', titleColor: '#ff79c6', bodyColor: '#8be9fd' }
        },
        scales: {
            x: { ticks: { color: '#6272a4' }, grid: { color: 'rgba(98, 114, 164, 0.2)' } },
            y: { ticks: { color: '#6272a4' }, grid: { color: 'rgba(98, 114, 164, 0.2)' } }
        }
    };
    const pieOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'right', labels: { color: '#f8f8f2' } },
            tooltip: { backgroundColor: 'rgba(40,42,54,0.9)', titleColor: '#ff79c6', bodyColor: '#8be9fd' }
        }
    };

    // 2. Character Time Pie Chart
    const charLabels = Object.keys(stats.character_time);
    const charData = charLabels.map(k => Math.round(stats.character_time[k] / 60));
    
    if (chartsInstances.charPie) chartsInstances.charPie.destroy();
    const ctxPie = document.getElementById('chart-character-time').getContext('2d');
    chartsInstances.charPie = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: charLabels,
            datasets: [{
                data: charData,
                backgroundColor: charLabels.map((k, i) => (stats.character_colors && stats.character_colors[k]) ? stats.character_colors[k] : ['#ff79c6', '#8be9fd', '#50fa7b', '#ffb86c', '#bd93f9', '#ff5555'][i % 6]),
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: pieOptions
    });

    // 3. Weekly Usage Bar Chart
    if (chartsInstances.weeklyBar) chartsInstances.weeklyBar.destroy();
    const ctxBar = document.getElementById('chart-weekly-usage').getContext('2d');
    chartsInstances.weeklyBar = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: stats.weekly_usage.labels,
            datasets: [{
                label: '活跃时长 (分钟)',
                data: stats.weekly_usage.data,
                backgroundColor: 'rgba(139, 233, 253, 0.6)',
                borderColor: '#8be9fd',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: commonOptions
    });

    // 4. Daily Dialogs Line Chart
    if (chartsInstances.dialogsLine) chartsInstances.dialogsLine.destroy();
    const ctxLine = document.getElementById('chart-daily-dialogs').getContext('2d');
    chartsInstances.dialogsLine = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: stats.daily_dialogs.labels,
            datasets: [{
                label: '对话次数',
                data: stats.daily_dialogs.data,
                backgroundColor: 'rgba(255, 121, 198, 0.2)',
                borderColor: '#ff79c6',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#ffb86c'
            }]
        },
        options: commonOptions
    });

    // 5. Activity Table
    const tbody = document.getElementById('stats-activity-table').querySelector('tbody');
    tbody.innerHTML = '';
    stats.recent_activity.forEach(act => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        
        const td1 = document.createElement('td');
        td1.textContent = act.date;
        td1.style.padding = '10px';
        td1.style.color = '#bd93f9';
        
        const td2 = document.createElement('td');
        td2.textContent = act.open_time;
        td2.style.padding = '10px';
        td2.style.color = '#50fa7b';
        
        const td3 = document.createElement('td');
        td3.textContent = act.close_time;
        td3.style.padding = '10px';
        td3.style.color = '#ff5555';
        
        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.appendChild(td3);
        tbody.appendChild(tr);
    });
}

// System Version and One-Click Update Management
async function initAboutVersionView() {
    const versionBadge = document.getElementById('current-version-badge');
    const commitBadge = document.getElementById('commit-hash-badge');
    const btnCheckUpdate = document.getElementById('btn-check-version-update');
    const btnPerformUpdate = document.getElementById('btn-perform-git-update');
    const btnRestartApp = document.getElementById('btn-restart-app-after-update');
    const statusContainer = document.getElementById('update-status-container');
    const statusHeader = document.getElementById('update-status-header');
    const changelogList = document.getElementById('update-changelog-list');

    if (!versionBadge || !btnCheckUpdate) return;

    // Load initial local version info
    try {
        const res = await fetch('/api/system/version');
        const data = await res.json();
        if (data.status === 'success') {
            versionBadge.textContent = `当前版本: v${data.version}`;
            if (data.commit) {
                commitBadge.textContent = `git (${data.commit})`;
            }
        }
    } catch (e) {
        console.error('加载系统版本信息失败:', e);
    }

    // Bind Check Update Click
    btnCheckUpdate.addEventListener('click', async () => {
        btnCheckUpdate.disabled = true;
        btnCheckUpdate.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 连接远程仓库中...';
        btnPerformUpdate.classList.add('hidden');
        btnRestartApp.classList.add('hidden');
        statusContainer.classList.remove('hidden');
        statusHeader.style.color = '#bd93f9';
        statusHeader.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> 正在向 GitHub 远程仓库获取更新，请稍候...';
        changelogList.textContent = '';

        try {
            const res = await fetch('/api/system/check_update', { method: 'POST' });
            const data = await res.json();

            if (res.ok && data.status === 'success') {
                if (data.has_update) {
                    statusHeader.style.color = '#50fa7b';
                    statusHeader.innerHTML = `<i class="fas fa-arrow-circle-up"></i> 发现新版本！远程最新版本为: v${data.latest_version} (HEAD: ${data.local_commit} -> Remote: ${data.remote_commit})`;
                    if (data.commit_logs && data.commit_logs.length > 0) {
                        changelogList.textContent = '【近期更新说明】:\n' + data.commit_logs.join('\n');
                    } else {
                        changelogList.textContent = '暂无详细更新日志描述。';
                    }
                    btnPerformUpdate.classList.remove('hidden');
                } else {
                    statusHeader.style.color = '#8be9fd';
                    statusHeader.innerHTML = `<i class="fas fa-check-circle"></i> 当前已是最新版本 (v${data.current_version})！代码处于主分支最新状态。`;
                    changelogList.textContent = '暂无待更新内容。';
                }
            } else {
                statusHeader.style.color = '#ff5555';
                statusHeader.innerHTML = `<i class="fas fa-exclamation-triangle"></i> 检测更新失败`;
                changelogList.textContent = data.message || '网络连接超时或未配置 Git 环境。';
            }
        } catch (e) {
            statusHeader.style.color = '#ff5555';
            statusHeader.innerHTML = `<i class="fas fa-times-circle"></i> 请求发生错误`;
            changelogList.textContent = e.toString();
        } finally {
            btnCheckUpdate.disabled = false;
            btnCheckUpdate.innerHTML = '<i class="fas fa-sync-alt"></i> 检查远程更新';
        }
    });

    // Bind Perform Update Click
    btnPerformUpdate.addEventListener('click', async () => {
        btnPerformUpdate.disabled = true;
        btnPerformUpdate.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在安全更新代码...';
        statusHeader.style.color = '#ffb86c';
        statusHeader.innerHTML = '<i class="fas fa-download fa-spin"></i> 正在拉取远程最新增量代码 (git pull)...';

        try {
            const res = await fetch('/api/system/perform_update', { method: 'POST' });
            const data = await res.json();

            if (res.ok && data.status === 'success') {
                statusHeader.style.color = '#50fa7b';
                statusHeader.innerHTML = `<i class="fas fa-check-circle"></i> ${data.message}`;
                changelogList.textContent = data.output || '更新成功！';
                btnPerformUpdate.classList.add('hidden');
                btnRestartApp.classList.remove('hidden');
            } else {
                statusHeader.style.color = '#ff5555';
                statusHeader.innerHTML = `<i class="fas fa-exclamation-triangle"></i> 更新过程遭遇错误`;
                changelogList.textContent = data.message || '更新失败。';
            }
        } catch (e) {
            statusHeader.style.color = '#ff5555';
            statusHeader.innerHTML = `<i class="fas fa-times-circle"></i> 更新请求异常`;
            changelogList.textContent = e.toString();
        } finally {
            btnPerformUpdate.disabled = false;
            btnPerformUpdate.innerHTML = '<i class="fas fa-download"></i> 一键更新至最新版';
        }
    });

    // Bind Restart App Click
    btnRestartApp.addEventListener('click', async () => {
        if (confirm('确认立即重启桌宠应用以加载最新版本的代码吗？')) {
            if (typeof window.triggerAppRestart === 'function') {
                window.triggerAppRestart();
            } else {
                try {
                    await fetch('/api/restart', { method: 'POST' });
                    alert('系统正在重启中，请稍候...');
                } catch (e) {
                    alert('触发重启时发生错误: ' + e.toString());
                }
            }
        }
    });

    // Bind Offline ZIP Force Update
    const inputZipUpdateFile = document.getElementById('input-zip-update-file');
    const btnImportZipCard = document.getElementById('btn-import-zip-update-card');

    if (btnImportZipCard && inputZipUpdateFile) {
        btnImportZipCard.addEventListener('click', () => {
            inputZipUpdateFile.click();
        });

        inputZipUpdateFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.name.toLowerCase().endsWith('.zip')) {
                alert('请选择 .zip 格式的源码压缩包！');
                inputZipUpdateFile.value = '';
                return;
            }

            if (!confirm(`确定要从本地 ZIP 压缩包「${file.name}」强制导入更新代码吗？\n（个人数据、记忆库与 API 配置将被安全保留）`)) {
                inputZipUpdateFile.value = '';
                return;
            }

            btnImportZipCard.disabled = true;
            btnImportZipCard.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i> 正在解压并覆盖更新...';

            statusContainer.classList.remove('hidden');
            statusHeader.style.color = '#ffb86c';
            statusHeader.innerHTML = '<i class="fas fa-file-import fa-spin"></i> 正在上传并解析 ZIP 增量代码包...';
            changelogList.textContent = `已选文件: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)\n正在安全校验目录并执行增量写入，请稍候...`;

            try {
                const formData = new FormData();
                formData.append('file', file);

                const res = await fetch('/api/system/import_update_zip', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();

                if (res.ok && data.status === 'success') {
                    statusHeader.style.color = '#50fa7b';
                    statusHeader.innerHTML = `<i class="fas fa-check-circle"></i> ${data.message}`;
                    changelogList.textContent = `✅ 成功覆盖同步 ${data.updated_count} 个核心代码文件\n🛡️ 安全保留 ${data.skipped_count} 个用户个人数据与本地配置文件\n\n代码已成功写入本地项目，请点击「重启桌宠生效」加载新版本！`;
                    
                    if (data.new_version) {
                        const currentBadge = document.getElementById('current-version-badge');
                        if (currentBadge) currentBadge.textContent = `当前版本: v${data.new_version}`;
                    }

                    btnPerformUpdate.classList.add('hidden');
                    btnRestartApp.classList.remove('hidden');
                } else {
                    statusHeader.style.color = '#ff5555';
                    statusHeader.innerHTML = `<i class="fas fa-exclamation-triangle"></i> 离线包导入更新失败`;
                    changelogList.textContent = data.message || '未知错误。';
                }
            } catch (err) {
                statusHeader.style.color = '#ff5555';
                statusHeader.innerHTML = `<i class="fas fa-times-circle"></i> 导入更新请求异常`;
                changelogList.textContent = err.toString();
            } finally {
                btnImportZipCard.disabled = false;
                btnImportZipCard.innerHTML = '<i class="fas fa-upload" style="margin-right: 8px;"></i> 选择本地 ZIP 文件更新';
                inputZipUpdateFile.value = '';
            }
        });
    }

    // Bind Export Logs Click
    const handleExportLogs = () => {
        window.location.href = '/api/system/export_logs';
    };

    const btnExportLogs = document.getElementById('btn-export-all-logs');
    if (btnExportLogs) {
        btnExportLogs.addEventListener('click', handleExportLogs);
    }

    const btnExportLogsCard = document.getElementById('btn-export-all-logs-card');
    if (btnExportLogsCard) {
        btnExportLogsCard.addEventListener('click', handleExportLogs);
    }

    // 🛡️ Fail-Safe Character Backup Engine Management
    const backupStatusPill = document.getElementById('backup-status-pill');
    const backupLastTimeText = document.getElementById('backup-last-time-text');
    const backupCharsCountText = document.getElementById('backup-chars-count-text');
    const btnForceBackup = document.getElementById('btn-force-backup-characters');
    const btnOpenBackupFolder = document.getElementById('btn-open-backup-folder');

    async function refreshBackupStatus() {
        if (!backupStatusPill) return;
        try {
            const res = await fetch('/api/system/backup_status');
            const data = await res.json();
            if (data.status === 'success' && data.data) {
                const info = data.data;
                if (info.has_backup) {
                    if (info.is_valid_within_3_days) {
                        const remainHours = Math.max(0, Math.round(72 - (info.elapsed_hours || 0)));
                        backupStatusPill.textContent = `✅ 3日内已备份保护中 (剩余约 ${remainHours} 小时)`;
                        backupStatusPill.style.background = 'rgba(80, 250, 123, 0.2)';
                        backupStatusPill.style.color = '#50fa7b';
                    } else {
                        backupStatusPill.textContent = '⚠️ 备份已超3日 (待更新备份)';
                        backupStatusPill.style.background = 'rgba(255, 184, 108, 0.2)';
                        backupStatusPill.style.color = '#ffb86c';
                    }
                    if (backupLastTimeText) backupLastTimeText.textContent = `${info.last_backup_time} (共 ${info.total_size_mb || 0} MB)`;
                    if (backupCharsCountText) backupCharsCountText.textContent = `${info.backup_count} 个角色包完整就绪`;
                } else {
                    backupStatusPill.textContent = '未生成备份';
                    backupStatusPill.style.background = 'rgba(255, 85, 85, 0.2)';
                    backupStatusPill.style.color = '#ff5555';
                    if (backupLastTimeText) backupLastTimeText.textContent = '尚未备份';
                    if (backupCharsCountText) backupCharsCountText.textContent = '0 个';
                }
            }
        } catch (e) {
            console.error('获取备份状态失败:', e);
        }
    }

    if (btnForceBackup) {
        btnForceBackup.addEventListener('click', async () => {
            btnForceBackup.disabled = true;
            const originalHtml = btnForceBackup.innerHTML;
            btnForceBackup.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 6px;"></i> 正在全量导出打包角色中...';
            try {
                const res = await fetch('/api/system/backup_characters', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ force: true })
                });
                const result = await res.json();
                if (result.status === 'success') {
                    alert(result.message || '全量角色包备份成功！');
                    await refreshBackupStatus();
                } else {
                    alert('备份失败: ' + (result.message || '未知错误'));
                }
            } catch (e) {
                alert('请求备份异常: ' + e);
            } finally {
                btnForceBackup.disabled = false;
                btnForceBackup.innerHTML = originalHtml;
            }
        });
    }

    if (btnOpenBackupFolder) {
        btnOpenBackupFolder.addEventListener('click', async () => {
            try {
                const res = await fetch('/api/system/open_backup_folder', { method: 'POST' });
                const result = await res.json();
                if (result.status !== 'success') {
                    alert('打开文件夹失败: ' + (result.message || '未知错误'));
                }
            } catch (e) {
                alert('请求打开文件夹异常: ' + e);
            }
        });
    }

    refreshBackupStatus();
}

// Hook into nav logic
document.addEventListener('DOMContentLoaded', () => {
    initAboutVersionView();
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const target = item.getAttribute('data-target');
            if (target === 'dashboard-stats-view') {
                loadDashboardStats();
            } else if (target === 'about-view') {
                initAboutVersionView();
            }
        });
    });
});
