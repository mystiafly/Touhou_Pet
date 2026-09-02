// character_reactions.js - 互动应付词与离线语音工坊 (Reactions & Offline Voice Workshop)
document.addEventListener('DOMContentLoaded', () => {
    const btnRefreshReactions = document.getElementById('btn-refresh-reactions');
    const btnBatchRecordUnrecorded = document.getElementById('btn-batch-record-unrecorded');
    const btnBatchRecordAll = document.getElementById('btn-batch-record-all');
    const btnStopBatchRecord = document.getElementById('btn-stop-batch-record');
    const btnRegenerateReactions = document.getElementById('btn-regenerate-reactions');
    const statBadge = document.getElementById('reactions-voice-stat-badge');

    const batchProgressCard = document.getElementById('reactions-batch-progress-card');
    const progressBarFill = document.getElementById('reactions-progress-bar-fill');
    const progressStatusText = document.getElementById('reactions-progress-status-text');
    const progressPercentText = document.getElementById('reactions-progress-percent-text');
    const progressCurrentItem = document.getElementById('reactions-progress-current-item');

    const reactionsContainer = document.getElementById('reactions-content');
    const reactionsLoading = document.getElementById('reactions-loading');

    let currentAudioPlayer = new Audio();
    let currentPlayingBtn = null;
    let batchPollTimer = null;
    let isBatchRunning = false;

    // 监听导航切换
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            if (item.getAttribute('data-target') === 'reactions-view') {
                loadReactions();
            }
        });
    });

    if (btnRefreshReactions) {
        btnRefreshReactions.addEventListener('click', loadReactions);
    }

    if (btnBatchRecordUnrecorded) {
        btnBatchRecordUnrecorded.addEventListener('click', () => startBatchRecording(false));
    }

    if (btnBatchRecordAll) {
        btnBatchRecordAll.addEventListener('click', async () => {
            if (await window.asyncConfirm('确定要使用当前角色的最新 TTS 音色，强制全量重录所有情绪的全部应付词语音吗？')) {
                startBatchRecording(true);
            }
        });
    }

    if (btnStopBatchRecord) {
        btnStopBatchRecord.addEventListener('click', stopBatchRecording);
    }

    if (btnRegenerateReactions) {
        btnRegenerateReactions.addEventListener('click', regenerateReactions);
    }

    const emotionMap = {
        'normal': '日常 (Normal)',
        'angry': '生气 (Angry)',
        'crying': '委屈 (Crying)',
        'shy': '害羞 (Shy)',
        'sleeping': '沉睡 (Sleeping)'
    };
    const emotionIcons = {
        'normal': 'fa-smile-beam',
        'angry': 'fa-angry',
        'crying': 'fa-sad-tear',
        'shy': 'fa-flushed',
        'sleeping': 'fa-bed'
    };
    const emotionColors = {
        'normal': '#8be9fd',
        'angry': '#ff5555',
        'crying': '#bd93f9',
        'shy': '#ff79c6',
        'sleeping': '#f1fa8c'
    };

    function stopCurrentAudio() {
        if (currentAudioPlayer) {
            currentAudioPlayer.pause();
            currentAudioPlayer.currentTime = 0;
        }
        if (currentPlayingBtn) {
            currentPlayingBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            currentPlayingBtn.classList.remove('playing');
            currentPlayingBtn = null;
        }
    }

    currentAudioPlayer.addEventListener('ended', stopCurrentAudio);
    currentAudioPlayer.addEventListener('error', stopCurrentAudio);

    function renderReactions(reactionsData, reactionsDetail, isGenerating) {
        if (!reactionsContainer) return;
        reactionsContainer.innerHTML = '';

        if (isGenerating) {
            reactionsContainer.innerHTML = `<div style="padding: 15px; background: rgba(255, 121, 198, 0.2); border-left: 4px solid #ff79c6; border-radius: 4px; color: #fff; margin-bottom: 15px;">
                <i class="fas fa-magic fa-spin"></i> 系统检测到词库过少，正在后台自动调用大模型生成补全...请稍后刷新查看。下方显示的是临时保底数据。
            </div>`;
        }

        const emotions = ['normal', 'angry', 'crying', 'shy', 'sleeping'];
        let totalCount = 0;
        let totalRecorded = 0;

        emotions.forEach(emo => {
            const detailList = (reactionsDetail && reactionsDetail[emo]) || [];
            const textList = reactionsData[emo] || [];

            // 对齐数据条目
            const items = detailList.length > 0 ? detailList : textList.map(t => ({ text: t, has_audio: false, audio_url: null }));
            const color = emotionColors[emo] || '#fff';
            const icon = emotionIcons[emo] || 'fa-comment';

            const recordedCount = items.filter(i => i.has_audio).length;
            totalCount += items.length;
            totalRecorded += recordedCount;

            const groupDiv = document.createElement('div');
            groupDiv.style.cssText = `background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 15px; transition: border-color 0.2s;`;

            const title = document.createElement('h4');
            title.style.cssText = `color: ${color}; margin-top: 0; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px; font-size: 14px;`;
            title.innerHTML = `
                <span style="display: flex; align-items: center; gap: 8px;"><i class="fas ${icon}"></i> ${emotionMap[emo] || emo}</span>
                <span style="font-size: 12px; opacity: 0.8; font-weight: normal;">
                    <i class="fas fa-microphone" style="color: ${recordedCount === items.length && items.length > 0 ? '#50fa7b' : '#ffb86c'};"></i>
                    离线语音: ${recordedCount} / ${items.length} 句
                </span>
            `;
            groupDiv.appendChild(title);

            const tagsContainer = document.createElement('div');
            tagsContainer.style.cssText = `display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 15px; min-height: 36px;`;

            if (items.length === 0) {
                tagsContainer.innerHTML = `<span style="color: #666; font-size: 12px; font-style: italic; padding: 6px 0;">暂无应付词</span>`;
            } else {
                items.forEach(item => {
                    const tag = document.createElement('div');
                    tag.style.cssText = `background: rgba(40, 42, 54, 0.7); border: 1px solid ${item.has_audio ? 'rgba(80, 250, 123, 0.4)' : 'rgba(255,255,255,0.12)'}; padding: 6px 12px; border-radius: 20px; font-size: 13px; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.2); transition: all 0.2s;`;

                    // 1. 试听 / 即时录制播放按钮
                    const playBtn = document.createElement('button');
                    playBtn.className = 'reaction-play-btn';
                    playBtn.title = item.has_audio ? '点击播放离线语音' : '尚未录制离线语音，点击立即生成并试听';
                    playBtn.style.cssText = `background: ${item.has_audio ? 'rgba(80, 250, 123, 0.2)' : 'rgba(255, 184, 108, 0.2)'}; border: none; color: ${item.has_audio ? '#50fa7b' : '#ffb86c'}; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 11px; transition: transform 0.15s;`;
                    playBtn.innerHTML = item.has_audio ? '<i class="fas fa-volume-up"></i>' : '<i class="fas fa-microphone-alt"></i>';

                    playBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        handlePlayOrRecord(emo, item, playBtn, tag);
                    });

                    // 2. 文本显示
                    const textSpan = document.createElement('span');
                    textSpan.textContent = item.text;
                    textSpan.style.color = '#f8f8f2';

                    // 3. 单句重录覆写按钮 (最新音色)
                    const reRecordBtn = document.createElement('button');
                    reRecordBtn.className = 'reaction-rerecord-btn';
                    reRecordBtn.title = '使用当前角色的最新 TTS 音色重新合成并覆盖此条离线语音';
                    reRecordBtn.style.cssText = `background: transparent; border: none; color: var(--text-secondary); cursor: pointer; font-size: 11px; padding: 2px 4px; border-radius: 4px; opacity: 0.6; transition: opacity 0.2s;`;
                    reRecordBtn.innerHTML = '<i class="fas fa-redo"></i>';
                    reRecordBtn.addEventListener('mouseenter', () => reRecordBtn.style.opacity = '1');
                    reRecordBtn.addEventListener('mouseleave', () => reRecordBtn.style.opacity = '0.6');
                    reRecordBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        handleReRecordSingle(emo, item, playBtn, tag, reRecordBtn);
                    });

                    // 4. 删除按钮
                    const deleteBtn = document.createElement('i');
                    deleteBtn.className = 'fas fa-times delete-btn';
                    deleteBtn.style.cssText = `cursor: pointer; color: #ff5555; opacity: 0.6; font-size: 12px; margin-left: 2px; transition: opacity 0.2s;`;
                    deleteBtn.title = '删除此应付词';
                    deleteBtn.addEventListener('mouseenter', () => deleteBtn.style.opacity = '1');
                    deleteBtn.addEventListener('mouseleave', () => deleteBtn.style.opacity = '0.6');
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        deleteReaction(emo, item.text);
                    });

                    tag.appendChild(playBtn);
                    tag.appendChild(textSpan);
                    tag.appendChild(reRecordBtn);
                    tag.appendChild(deleteBtn);
                    tagsContainer.appendChild(tag);
                });
            }
            groupDiv.appendChild(tagsContainer);

            // 底部快速新增输入框
            const addForm = document.createElement('div');
            addForm.style.cssText = `display: flex; gap: 8px; align-items: center;`;
            addForm.innerHTML = `
                <input type="text" class="modern-input reaction-input" placeholder="添加【${emotionMap[emo] || emo}】新应付词..." style="flex: 1; padding: 7px 12px; font-size: 13px;">
                <button class="action-btn outline btn-add-reaction" style="padding: 7px 16px; font-size: 13px;"><i class="fas fa-plus"></i> 添加</button>
            `;

            const inputField = addForm.querySelector('.reaction-input');
            const addBtn = addForm.querySelector('.btn-add-reaction');

            const doAdd = () => {
                const text = inputField.value.trim();
                if (text) {
                    addReaction(emo, text);
                    inputField.value = '';
                }
            };
            addBtn.addEventListener('click', doAdd);
            inputField.addEventListener('keypress', (e) => { if (e.key === 'Enter') doAdd(); });

            groupDiv.appendChild(addForm);
            reactionsContainer.appendChild(groupDiv);
        });

        // 更新顶部总统计标签
        if (statBadge) {
            const pct = totalCount > 0 ? Math.round((totalRecorded / totalCount) * 100) : 0;
            statBadge.innerHTML = `<i class="fas fa-check-circle" style="color: #50fa7b;"></i> 离线语音覆盖率: ${totalRecorded} / ${totalCount} 句 (${pct}%)`;
            statBadge.style.background = pct === 100 ? 'rgba(80, 250, 123, 0.2)' : 'rgba(139, 233, 253, 0.15)';
            statBadge.style.color = pct === 100 ? '#50fa7b' : '#8be9fd';
        }
    }

    async function handlePlayOrRecord(emotion, item, playBtn, tag) {
        // 如果当前正在播放该音频，则暂停
        if (currentPlayingBtn === playBtn) {
            stopCurrentAudio();
            return;
        }

        stopCurrentAudio();

        // 1. 如果已有离线语音，直接播放
        if (item.has_audio && item.audio_url) {
            currentPlayingBtn = playBtn;
            playBtn.innerHTML = '<i class="fas fa-pause"></i>';
            playBtn.classList.add('playing');
            currentAudioPlayer.src = item.audio_url + (item.audio_url.includes('?') ? '&' : '?') + 't=' + Date.now();
            currentAudioPlayer.play().catch(e => {
                console.warn('音频播放异常:', e);
                stopCurrentAudio();
            });
            return;
        }

        // 2. 尚未录制，调用后端单句实时录制
        playBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        try {
            const res = await fetch('/api/pet_reactions/record_single', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    emotion: emotion,
                    text: item.text
                })
            });
            const data = await res.json();
            if (data.success && data.audio_url) {
                item.has_audio = true;
                item.audio_url = data.audio_url;

                tag.style.borderColor = 'rgba(80, 250, 123, 0.4)';
                playBtn.style.background = 'rgba(80, 250, 123, 0.2)';
                playBtn.style.color = '#50fa7b';
                playBtn.title = '点击播放离线语音';

                currentPlayingBtn = playBtn;
                playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                playBtn.classList.add('playing');

                currentAudioPlayer.src = data.audio_url + '?t=' + Date.now();
                currentAudioPlayer.play().catch(e => console.warn(e));
            } else {
                playBtn.innerHTML = '<i class="fas fa-microphone-alt"></i>';
                alert('语音录制失败: ' + (data.error || 'TTS 服务异常'));
            }
        } catch (e) {
            playBtn.innerHTML = '<i class="fas fa-microphone-alt"></i>';
            alert('录制请求异常: ' + e);
        }
    }

    async function handleReRecordSingle(emotion, item, playBtn, tag, reRecordBtn) {
        stopCurrentAudio();
        const origIcon = reRecordBtn.innerHTML;
        reRecordBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        reRecordBtn.disabled = true;

        try {
            const res = await fetch('/api/pet_reactions/record_single', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    emotion: emotion,
                    text: item.text
                })
            });
            const data = await res.json();
            if (data.success && data.audio_url) {
                item.has_audio = true;
                item.audio_url = data.audio_url;

                tag.style.borderColor = 'rgba(80, 250, 123, 0.4)';
                playBtn.style.background = 'rgba(80, 250, 123, 0.2)';
                playBtn.style.color = '#50fa7b';
                playBtn.title = '点击播放离线语音';

                currentPlayingBtn = playBtn;
                playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                playBtn.classList.add('playing');

                currentAudioPlayer.src = data.audio_url + '?t=' + Date.now();
                currentAudioPlayer.play().catch(e => console.warn(e));
            } else {
                alert('重录失败: ' + (data.error || 'TTS 服务异常'));
            }
        } catch (e) {
            alert('重录请求异常: ' + e);
        } finally {
            reRecordBtn.innerHTML = origIcon;
            reRecordBtn.disabled = false;
        }
    }

    async function startBatchRecording(forceOverwrite = false) {
        if (isBatchRunning) return;
        try {
            const res = await fetch('/api/pet_reactions/batch_generate_audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force_overwrite: forceOverwrite })
            });
            const data = await res.json();
            if (data.success) {
                isBatchRunning = true;
                updateBatchUiState(true);
                pollBatchProgress();
            } else {
                alert(data.message || '启动批量录制失败');
            }
        } catch (e) {
            alert('启动批量录制异常: ' + e);
        }
    }

    function pollBatchProgress() {
        if (batchPollTimer) clearInterval(batchPollTimer);
        batchPollTimer = setInterval(async () => {
            try {
                const res = await fetch('/api/pet_reactions/batch_progress');
                const data = await res.json();

                const total = data.total || 0;
                const completed = data.completed || 0;
                const percent = data.percent || 0;
                const isRunning = !!data.is_running;

                if (progressBarFill) progressBarFill.style.width = percent + '%';
                if (progressPercentText) progressPercentText.textContent = `${percent}% (${completed}/${total})`;
                if (progressCurrentItem) {
                    const emoName = emotionMap[data.current_emotion] || data.current_emotion || '';
                    progressCurrentItem.textContent = data.current_text ? `当前正在录制 [${emoName}]: "${data.current_text}"` : '正在准备中...';
                }

                if (!isRunning) {
                    clearInterval(batchPollTimer);
                    batchPollTimer = null;
                    isBatchRunning = false;
                    updateBatchUiState(false);
                    await loadReactions();
                }
            } catch (e) {
                console.error('查询批量录制进度失败:', e);
            }
        }, 1000);
    }

    async function stopBatchRecording() {
        try {
            await fetch('/api/pet_reactions/stop_batch', { method: 'POST' });
            isBatchRunning = false;
            if (batchPollTimer) {
                clearInterval(batchPollTimer);
                batchPollTimer = null;
            }
            updateBatchUiState(false);
            await loadReactions();
        } catch (e) {
            console.error('停止批量录制失败:', e);
        }
    }

    function updateBatchUiState(running) {
        if (batchProgressCard) batchProgressCard.style.display = running ? 'block' : 'none';
        if (btnStopBatchRecord) btnStopBatchRecord.style.display = running ? 'inline-flex' : 'none';
        if (btnBatchRecordUnrecorded) btnBatchRecordUnrecorded.disabled = running;
        if (btnBatchRecordAll) btnBatchRecordAll.disabled = running;
        if (btnRegenerateReactions) btnRegenerateReactions.disabled = running;
    }

    async function regenerateReactions() {
        if (!await window.asyncConfirm('确定要清空并让大模型重新生成此角色的 5x5 应付词库吗？')) return;
        try {
            const res = await fetch('/api/pet_reactions/regenerate', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert('已触发后台生成，系统正在调用大模型精修生成中，请稍候刷新。');
                setTimeout(() => loadReactions(), 3000);
            }
        } catch (e) {
            alert('重新生成失败: ' + e);
        }
    }

    async function loadReactions() {
        if (!reactionsContainer) return;
        if (reactionsLoading) reactionsLoading.style.display = 'block';
        reactionsContainer.style.display = 'none';

        try {
            const res = await fetch('/api/pet_reactions');
            const data = await res.json();
            if (data.success) {
                renderReactions(data.reactions || {}, data.reactions_detail || {}, data.is_generating);
                reactionsContainer.style.display = 'flex';
            } else {
                alert('加载应付词库失败: ' + (data.error || '未知错误'));
            }
        } catch (err) {
            console.error(err);
        } finally {
            if (reactionsLoading) reactionsLoading.style.display = 'none';
        }

        // 检查是否有后台批量录制任务正在运行
        try {
            const pRes = await fetch('/api/pet_reactions/batch_progress');
            const pData = await pRes.json();
            if (pData.is_running) {
                isBatchRunning = true;
                updateBatchUiState(true);
                pollBatchProgress();
            }
        } catch (e) {
            console.warn(e);
        }
    }

    async function addReaction(emotion, text) {
        try {
            const res = await fetch('/api/pet_reactions/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emotion, text })
            });
            const data = await res.json();
            if (data.success) {
                loadReactions();
            } else {
                alert('添加失败: ' + (data.error || '未知错误'));
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function deleteReaction(emotion, text) {
        stopCurrentAudio();
        try {
            const res = await fetch('/api/pet_reactions/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emotion, text })
            });
            const data = await res.json();
            if (data.success) {
                loadReactions();
            } else {
                alert('删除失败: ' + (data.error || '未知错误'));
            }
        } catch (err) {
            console.error(err);
        }
    }

    window.loadReactions = loadReactions;
});
