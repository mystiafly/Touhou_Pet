// character_reactions.js - 互动应付词管理 (Reactions)
document.addEventListener('DOMContentLoaded', () => {
    const btnRefreshReactions = document.getElementById('btn-refresh-reactions');
    const reactionsContainer = document.getElementById('reactions-content');
    const reactionsLoading = document.getElementById('reactions-loading');
    
    // Also load when nav item is clicked
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (item.getAttribute('data-target') === 'reactions-view') {
                loadReactions();
            }
        });
    });

    if (btnRefreshReactions) {
        btnRefreshReactions.addEventListener('click', loadReactions);
    }

    const emotionMap = {
        'normal': '日常 (Normal)',
        'angry': '生气 (Angry)',
        'crying': '委屈 (Crying)',
        'shy': '害羞 (Shy)',
        'sleeping': '沉睡 (Sleeping)'
    };
    const emotionColors = {
        'normal': '#8be9fd',
        'angry': '#ff5555',
        'crying': '#bd93f9',
        'shy': '#ff79c6',
        'sleeping': '#f1fa8c'
    };

    function renderReactions(data, isGenerating) {
        if (!reactionsContainer) return;
        reactionsContainer.innerHTML = '';
        if (isGenerating) {
            reactionsContainer.innerHTML = `<div style="padding: 15px; background: rgba(255, 121, 198, 0.2); border-left: 4px solid #ff79c6; border-radius: 4px; color: #fff; margin-bottom: 15px;">
                <i class="fas fa-magic fa-spin"></i> 系统检测到词库过少，正在后台自动调用大模型生成补全...请稍后刷新查看。下方显示的是临时保底数据。
            </div>`;
        }

        const emotions = ['normal', 'angry', 'crying', 'shy', 'sleeping'];
        emotions.forEach(emo => {
            const list = data[emo] || [];
            const color = emotionColors[emo] || '#fff';
            
            const groupDiv = document.createElement('div');
            groupDiv.style.cssText = `background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 15px;`;
            
            const title = document.createElement('h4');
            title.style.cssText = `color: ${color}; margin-top: 0; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px;`;
            title.innerHTML = `<span>${emotionMap[emo] || emo}</span> <span style="font-size: 12px; opacity: 0.7;">(${list.length} 句)</span>`;
            groupDiv.appendChild(title);
            
            const tagsContainer = document.createElement('div');
            tagsContainer.style.cssText = `display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px; min-height: 30px;`;
            
            if (list.length === 0) {
                tagsContainer.innerHTML = `<span style="color: #666; font-size: 12px; font-style: italic;">暂无应付词</span>`;
            } else {
                list.forEach(text => {
                    const tag = document.createElement('span');
                    tag.style.cssText = `background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 15px; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;`;
                    tag.innerHTML = `<span>${text}</span> <i class="fas fa-times delete-btn" style="cursor: pointer; color: #ff5555; opacity: 0.7;" title="删除"></i>`;
                    
                    tag.querySelector('.delete-btn').addEventListener('click', () => deleteReaction(emo, text));
                    tagsContainer.appendChild(tag);
                });
            }
            groupDiv.appendChild(tagsContainer);
            
            // Add form
            const addForm = document.createElement('div');
            addForm.style.cssText = `display: flex; gap: 8px;`;
            addForm.innerHTML = `
                <input type="text" class="modern-input reaction-input" placeholder="添加新应付词..." style="flex: 1; padding: 6px 12px; font-size: 13px;">
                <button class="action-btn outline btn-add-reaction" style="padding: 6px 12px; font-size: 13px;"><i class="fas fa-plus"></i></button>
            `;
            
            const inputField = addForm.querySelector('.reaction-input');
            const addBtn = addForm.querySelector('.btn-add-reaction');
            
            const doAdd = () => {
                const text = inputField.value.trim();
                if(text) {
                    addReaction(emo, text);
                    inputField.value = '';
                }
            };
            addBtn.addEventListener('click', doAdd);
            inputField.addEventListener('keypress', (e) => { if(e.key === 'Enter') doAdd(); });
            
            groupDiv.appendChild(addForm);
            reactionsContainer.appendChild(groupDiv);
        });
    }

    async function loadReactions() {
        if(!reactionsContainer) return;
        if(reactionsLoading) reactionsLoading.style.display = 'block';
        reactionsContainer.style.display = 'none';
        
        try {
            const res = await fetch('/api/pet_reactions');
            const data = await res.json();
            if (data.success) {
                renderReactions(data.reactions, data.is_generating);
                reactionsContainer.style.display = 'flex';
            } else {
                window.alert('加载应付词库失败: ' + data.error);
            }
        } catch (err) {
            console.error(err);
        } finally {
            if(reactionsLoading) reactionsLoading.style.display = 'none';
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
            if(data.success) {
                loadReactions();
            } else {
                window.alert('添加失败: ' + data.error);
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function deleteReaction(emotion, text) {
        try {
            const res = await fetch('/api/pet_reactions/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emotion, text })
            });
            const data = await res.json();
            if(data.success) {
                loadReactions();
            } else {
                window.alert('删除失败: ' + data.error);
            }
        } catch (err) {
            console.error(err);
        }
    }

    window.loadReactions = loadReactions;
});
