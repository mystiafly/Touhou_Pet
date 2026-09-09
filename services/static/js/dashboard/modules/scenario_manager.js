// 剧本设定管理模块 (Scenario Manager) - Galgame 剧情分支系统
(function() {
    let currentScenarioData = {
        nodes: [],
        state: {},
        character_id: '',
        character_name: '',
        favorability: 60,
        favorability_floor: 0
    };

    window.loadScenarioSettings = function() {
        const container = document.getElementById('scenario-nodes-container');
        if (!container) return;

        container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> 正在加载剧本数据...</div>';

        fetch('/api/scenario/data')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    currentScenarioData = data;
                    renderScenarioView(data);
                } else {
                    container.innerHTML = `<div class="error-state" style="color:#ff5555; padding:20px;">加载剧本失败: ${data.error || '未知错误'}</div>`;
                }
            })
            .catch(err => {
                container.innerHTML = `<div class="error-state" style="color:#ff5555; padding:20px;">网络或接口异常: ${err.message}</div>`;
            });
    };

    function renderScenarioView(data) {
        // 1. 刷新好感度与保底下限
        const favEl = document.getElementById('scenario-current-fav');
        const floorEl = document.getElementById('scenario-fav-floor');
        const statusBadge = document.getElementById('scenario-active-status-badge');

        if (favEl) favEl.innerText = data.favorability !== undefined ? data.favorability : '--';
        if (floorEl) floorEl.innerText = data.favorability_floor !== undefined ? data.favorability_floor : '0';

        const state = data.state || {};
        const activeNodeId = state.active_node_id;
        const completedNodes = state.completed_nodes || {};

        if (statusBadge) {
            if (activeNodeId) {
                const activeNode = (data.nodes || []).find(n => n.id === activeNodeId);
                const activeTitle = activeNode ? activeNode.title : activeNodeId;
                statusBadge.style.background = 'rgba(255, 121, 198, 0.2)';
                statusBadge.style.color = '#ff79c6';
                statusBadge.innerHTML = `<i class="fas fa-play-circle fa-spin"></i> 剧情进行中: 【${activeTitle}】 (第 ${state.turn_count || 0} 轮 / 好感度冻结)`;
            } else {
                statusBadge.style.background = 'rgba(80, 250, 123, 0.15)';
                statusBadge.style.color = '#50fa7b';
                statusBadge.innerHTML = '<i class="fas fa-check-circle"></i> 自由交流中 (好感度正常变动)';
            }
        }

        // 2. 渲染节点卡片列表
        const container = document.getElementById('scenario-nodes-container');
        if (!container) return;

        const nodes = data.nodes || [];
        if (nodes.length === 0) {
            container.innerHTML = `
                <div class="card" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    <i class="fas fa-scroll" style="font-size: 40px; margin-bottom: 15px; opacity: 0.5;"></i>
                    <p style="font-size: 16px; margin-bottom: 10px;">当前角色尚未配置任何剧情节点</p>
                    <p style="font-size: 13px;">点击右上角「新增剧情节点」，打造专属的 Galgame 故事线与情感抉择！</p>
                </div>
            `;
            return;
        }

        // 按触发好感度升序排列
        nodes.sort((a, b) => (parseInt(a.trigger_favorability, 10) || 0) - (parseInt(b.trigger_favorability, 10) || 0));

        let html = '';
        nodes.forEach(node => {
            const isCompleted = completedNodes.hasOwnProperty(node.id);
            const isActive = activeNodeId === node.id;
            const completedInfo = completedNodes[node.id] || null;

            let statusBadgeHtml = '';
            let cardBorder = '1px solid var(--border-color)';
            if (isActive) {
                statusBadgeHtml = `<span class="badge" style="background: rgba(255, 121, 198, 0.25); color: #ff79c6; font-size: 12px; padding: 4px 10px; border-radius: 12px;"><i class="fas fa-play"></i> 剧情进行中 (第 ${state.turn_count || 0} / ${node.check_interval || 5} 轮)</span>`;
                cardBorder = '1px solid #ff79c6';
            } else if (isCompleted) {
                statusBadgeHtml = `<span class="badge" style="background: rgba(80, 250, 123, 0.2); color: #50fa7b; font-size: 12px; padding: 4px 10px; border-radius: 12px;"><i class="fas fa-check-circle"></i> 已达成: 【${completedInfo.chosen_branch_name || '已完结'}】</span>`;
                cardBorder = '1px solid rgba(80, 250, 123, 0.4)';
            } else {
                statusBadgeHtml = `<span class="badge" style="background: rgba(255, 255, 255, 0.1); color: var(--text-muted); font-size: 12px; padding: 4px 10px; border-radius: 12px;"><i class="fas fa-clock"></i> 待触发</span>`;
            }

            // 分支列表 HTML
            const branches = node.branches || [];
            let branchesHtml = '';
            branches.forEach((b, bIdx) => {
                const isThisBranchChosen = isCompleted && completedInfo && completedInfo.chosen_branch_id === b.id;
                const favDelta = parseInt(b.fav_change, 10) || 0;
                const favDeltaStr = favDelta > 0 ? `+${favDelta}` : (favDelta < 0 ? `${favDelta}` : '0');
                const deltaColor = favDelta > 0 ? '#50fa7b' : (favDelta < 0 ? '#ff5555' : 'var(--text-muted)');

                branchesHtml += `
                    <div style="background: ${isThisBranchChosen ? 'rgba(80, 250, 123, 0.1)' : 'rgba(0,0,0,0.25)'}; border: 1px solid ${isThisBranchChosen ? '#50fa7b' : 'rgba(255,255,255,0.08)'}; border-radius: 8px; padding: 10px 14px; margin-top: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <div style="font-weight: bold; color: ${isThisBranchChosen ? '#50fa7b' : '#8be9fd'}; font-size: 14px;">
                                ${isThisBranchChosen ? '<i class="fas fa-check-circle"></i> ' : ''}分支 ${bIdx + 1}: 【${b.name || b.id}】
                            </div>
                            <div style="font-size: 12px; font-weight: bold; color: ${deltaColor}; background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 4px;">
                                好感度 ${favDeltaStr}
                            </div>
                        </div>
                        <div style="font-size: 13px; color: var(--text-main); line-height: 1.4;">
                            <span style="color: var(--text-muted);">判定依据: </span>${b.criteria || '无'}
                        </div>
                        ${b.databank_record ? `<div style="font-size: 12px; color: #ffb86c; margin-top: 4px;"><i class="fas fa-database"></i> 写入数据库: ${b.databank_record}</div>` : ''}
                    </div>
                `;
            });

            html += `
                <div class="card" style="border: ${cardBorder}; padding: 20px; transition: all 0.3s ease;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                <h3 style="margin: 0; font-size: 17px; color: #fff;">${node.title || '未命名节点'}</h3>
                                <span class="badge" style="background: rgba(255, 184, 108, 0.2); color: #ffb86c; font-size: 12px; padding: 3px 8px; border-radius: 6px;">
                                    触发好感度: ≥ ${node.trigger_favorability}
                                </span>
                                <span class="badge" style="background: rgba(139, 233, 253, 0.15); color: #8be9fd; font-size: 12px; padding: 3px 8px; border-radius: 6px;">
                                    判定周期: ${node.check_interval || 5} 轮
                                </span>
                                ${statusBadgeHtml}
                            </div>
                            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px; font-family: monospace;">ID: ${node.id}</div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="action-btn outline" onclick="editScenarioNode('${node.id}')" title="编辑节点" style="padding: 4px 10px; font-size: 12px;">
                                <i class="fas fa-edit"></i> 编辑
                            </button>
                            ${isCompleted || isActive ? `
                                <button class="action-btn outline" onclick="resetSingleNode('${node.id}')" title="重置此节点进度" style="padding: 4px 10px; font-size: 12px; color: #ffb86c; border-color: #ffb86c;">
                                    <i class="fas fa-undo"></i> 重置进度
                                </button>
                            ` : `
                                <button class="action-btn outline" onclick="triggerTestNode('${node.id}')" title="立即模拟激活此剧情" style="padding: 4px 10px; font-size: 12px; color: #50fa7b; border-color: #50fa7b;">
                                    <i class="fas fa-play"></i> 测试触发
                                </button>
                            `}
                            <button class="action-btn outline danger" onclick="deleteScenarioNode('${node.id}')" title="删除节点" style="padding: 4px 10px; font-size: 12px; color: #ff5555; border-color: #ff5555;">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>

                    <!-- 告知项展示 -->
                    <div style="background: rgba(255, 121, 198, 0.05); border-left: 3px solid #ff79c6; border-radius: 0 8px 8px 0; padding: 10px 14px; margin-bottom: 12px;">
                        <div style="font-size: 12px; font-weight: bold; color: #ff79c6; margin-bottom: 4px;">
                            <i class="fas fa-bullhorn"></i> 告知项 (Briefing - 注入桌宠上下文)
                        </div>
                        <div style="font-size: 13px; color: #f8f8f2; line-height: 1.5; white-space: pre-wrap;">${node.briefing || '未填写告知项'}</div>
                    </div>

                    <!-- 分支展示 -->
                    <div>
                        <div style="font-size: 13px; font-weight: bold; color: #8be9fd; margin-bottom: 6px;">
                            <i class="fas fa-code-branch"></i> 裁决分支项 (${branches.length} 个备选项):
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            ${branchesHtml}
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    // Modal Handling
    window.showScenarioModal = function(node = null) {
        const modal = document.getElementById('scenario-node-modal');
        if (!modal) return;

        modal.classList.remove('hidden');
        const branchesContainer = document.getElementById('scenario-branches-list');
        if (branchesContainer) branchesContainer.innerHTML = '';

        if (node) {
            document.getElementById('scenario-node-modal-title').innerHTML = '<i class="fas fa-edit"></i> 编辑剧情节点';
            document.getElementById('scenario-node-original-id').value = node.id;
            document.getElementById('scenario-node-id').value = node.id;
            document.getElementById('scenario-node-id').disabled = true; // 保持 ID 稳定
            document.getElementById('scenario-node-title').value = node.title || '';
            document.getElementById('scenario-trigger-fav').value = node.trigger_favorability !== undefined ? node.trigger_favorability : 60;
            document.getElementById('scenario-check-interval').value = node.check_interval || 5;
            document.getElementById('scenario-briefing').value = node.briefing || '';

            const branches = node.branches || [];
            if (branches.length > 0) {
                branches.forEach(b => addBranchRow(b));
            } else {
                addBranchRow();
            }
        } else {
            document.getElementById('scenario-node-modal-title').innerHTML = '<i class="fas fa-plus"></i> 新增剧情节点';
            document.getElementById('scenario-node-original-id').value = '';
            document.getElementById('scenario-node-id').value = 'node_' + Date.now().toString().slice(-6);
            document.getElementById('scenario-node-id').disabled = false;
            document.getElementById('scenario-node-title').value = '';
            document.getElementById('scenario-trigger-fav').value = 60;
            document.getElementById('scenario-check-interval').value = 5;
            document.getElementById('scenario-briefing').value = '';

            // 默认添加两个初始分支
            addBranchRow({ id: 'branch_accept', name: '同意/接受', criteria: '用户表示赞同、答应赴约、态度热情积极', fav_change: 3 });
            addBranchRow({ id: 'branch_decline', name: '拒绝/推托', criteria: '用户表示不想去、有事婉拒、态度冷淡', fav_change: -2 });
        }
    };

    window.hideScenarioModal = function() {
        const modal = document.getElementById('scenario-node-modal');
        if (modal) modal.classList.add('hidden');
    };

    window.addBranchRow = function(branch = null) {
        const container = document.getElementById('scenario-branches-list');
        if (!container) return;

        const row = document.createElement('div');
        row.className = 'scenario-branch-item';
        row.style.background = 'rgba(0,0,0,0.3)';
        row.style.border = '1px solid rgba(255,255,255,0.1)';
        row.style.borderRadius = '8px';
        row.style.padding = '12px';

        const bId = branch ? branch.id : ('branch_' + Date.now().toString().slice(-4));
        const bName = branch ? (branch.name || '') : '';
        const bCriteria = branch ? (branch.criteria || '') : '';
        const bFav = branch ? (branch.fav_change !== undefined ? branch.fav_change : 0) : 0;
        const bDb = branch ? (branch.databank_record || '') : '';

        row.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-weight: bold; font-size: 13px; color: #8be9fd;">分支定义</span>
                <button type="button" class="action-btn outline danger" style="padding: 2px 8px; font-size: 11px;" onclick="this.closest('.scenario-branch-item').remove()">
                    <i class="fas fa-times"></i> 移除分支
                </button>
            </div>
            <div class="grid-2col" style="gap: 10px; margin-bottom: 8px;">
                <div>
                    <label style="font-size: 12px; color: var(--text-muted);">分支名称 <span style="color:red">*</span></label>
                    <input type="text" class="modern-input branch-name" value="${bName}" placeholder="例如: 欣然答应赴约" style="padding: 6px 10px; font-size: 13px;">
                </div>
                <div>
                    <label style="font-size: 12px; color: var(--text-muted);">分支 ID <span style="color:red">*</span></label>
                    <input type="text" class="modern-input branch-id" value="${bId}" placeholder="例如: branch_accept" style="padding: 6px 10px; font-size: 13px;">
                </div>
            </div>
            <div style="margin-bottom: 8px;">
                <label style="font-size: 12px; color: var(--text-muted);">判定依据 (Prompt Criteria 给大模型裁决依据) <span style="color:red">*</span></label>
                <textarea class="modern-textarea branch-criteria" rows="2" placeholder="描述用户在对话中出现怎样的言行、态度或承诺判定为此分支..." style="padding: 6px 10px; font-size: 13px;">${bCriteria}</textarea>
            </div>
            <div class="grid-2col" style="gap: 10px;">
                <div>
                    <label style="font-size: 12px; color: var(--text-muted);">好感度额外增减分</label>
                    <input type="number" class="modern-input branch-fav-change" value="${bFav}" placeholder="例如: 3 或 -2" style="padding: 6px 10px; font-size: 13px;">
                </div>
                <div>
                    <label style="font-size: 12px; color: var(--text-muted);">写入 DataBank 关键记录 (选填)</label>
                    <input type="text" class="modern-input branch-databank" value="${bDb}" placeholder="例如: 约定周末去吃大份烤肉" style="padding: 6px 10px; font-size: 13px;">
                </div>
            </div>
        `;

        container.appendChild(row);
    };

    window.editScenarioNode = function(nodeId) {
        const node = (currentScenarioData.nodes || []).find(n => n.id === nodeId);
        if (node) {
            showScenarioModal(node);
        }
    };

    window.deleteScenarioNode = function(nodeId) {
        if (!confirm(`确定要彻底删除剧情节点 [${nodeId}] 吗？`)) return;

        const filtered = (currentScenarioData.nodes || []).filter(n => n.id !== nodeId);
        saveNodesToServer(filtered);
    };

    window.resetSingleNode = function(nodeId) {
        if (!confirm(`确定要重置节点 [${nodeId}] 的剧情进度吗？重置后可重新经历剧情抉择。`)) return;

        fetch('/api/scenario/reset_node', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                character_id: currentScenarioData.character_id,
                node_id: nodeId
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                loadScenarioSettings();
            } else {
                alert("重置失败: " + data.error);
            }
        });
    };

    window.triggerTestNode = function(nodeId) {
        if (!confirm(`确定要立即模拟激活节点 [${nodeId}] 吗？这将直接冻结好感度并开始本剧情对话引导。`)) return;

        fetch('/api/scenario/trigger_test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                character_id: currentScenarioData.character_id,
                node_id: nodeId
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert("已成功激活剧情节点！现在即可与桌宠聊天体验。");
                loadScenarioSettings();
            } else {
                alert("激活失败: " + data.error);
            }
        });
    };

    function saveNodesToServer(nodesList) {
        fetch('/api/scenario/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                character_id: currentScenarioData.character_id,
                nodes: nodesList
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                hideScenarioModal();
                loadScenarioSettings();
            } else {
                alert("保存失败: " + data.error);
            }
        })
        .catch(err => alert("保存请求异常: " + err.message));
    }

    // DOM Ready Bindings
    document.addEventListener('DOMContentLoaded', () => {
        const btnAdd = document.getElementById('btn-add-scenario-node');
        if (btnAdd) btnAdd.addEventListener('click', () => showScenarioModal());

        const btnClose = document.getElementById('close-scenario-modal-btn');
        if (btnClose) btnClose.addEventListener('click', () => hideScenarioModal());

        const btnCancel = document.getElementById('btn-cancel-scenario-modal');
        if (btnCancel) btnCancel.addEventListener('click', () => hideScenarioModal());

        const btnAddBranch = document.getElementById('btn-add-branch-item');
        if (btnAddBranch) btnAddBranch.addEventListener('click', () => addBranchRow());

        const btnResetAll = document.getElementById('btn-reset-all-scenarios');
        if (btnResetAll) {
            btnResetAll.addEventListener('click', () => {
                if (!confirm("⚠️ 确定要重置当前角色的【全部剧本进度】吗？已解锁的分支和好感度保底下限都将被重置。")) return;

                fetch('/api/scenario/reset_all', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ character_id: currentScenarioData.character_id })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        alert("已重置全部剧情进度！");
                        loadScenarioSettings();
                    } else {
                        alert("重置失败: " + data.error);
                    }
                });
            });
        }

        const btnSaveNode = document.getElementById('btn-save-scenario-node');
        if (btnSaveNode) {
            btnSaveNode.addEventListener('click', () => {
                const title = document.getElementById('scenario-node-title').value.trim();
                const id = document.getElementById('scenario-node-id').value.trim();
                const originalId = document.getElementById('scenario-node-original-id').value.trim();
                const fav = parseInt(document.getElementById('scenario-trigger-fav').value, 10);
                const interval = parseInt(document.getElementById('scenario-check-interval').value, 10) || 5;
                const briefing = document.getElementById('scenario-briefing').value.trim();

                if (!title || !id) {
                    alert("节点标题与 ID 为必填项！");
                    return;
                }
                if (isNaN(fav)) {
                    alert("请填写合法的触发好感度！");
                    return;
                }
                if (!briefing) {
                    alert("请填写告知项 (Briefing)！");
                    return;
                }

                // 提取分支项
                const branchRows = document.querySelectorAll('#scenario-branches-list .scenario-branch-item');
                const branches = [];
                for (let row of branchRows) {
                    const bName = row.querySelector('.branch-name').value.trim();
                    const bId = row.querySelector('.branch-id').value.trim();
                    const bCriteria = row.querySelector('.branch-criteria').value.trim();
                    const bFav = parseInt(row.querySelector('.branch-fav-change').value, 10) || 0;
                    const bDb = row.querySelector('.branch-databank').value.trim();

                    if (!bName || !bId || !bCriteria) {
                        alert("分支的名称、ID 与判定依据均为必填项！");
                        return;
                    }

                    branches.push({
                        id: bId,
                        name: bName,
                        criteria: bCriteria,
                        fav_change: bFav,
                        databank_record: bDb
                    });
                }

                if (branches.length === 0) {
                    alert("至少需要配置一个分支项！");
                    return;
                }

                const nodeObj = {
                    id: id,
                    title: title,
                    trigger_favorability: fav,
                    check_interval: interval,
                    briefing: briefing,
                    branches: branches
                };

                const nodes = currentScenarioData.nodes ? [...currentScenarioData.nodes] : [];
                const existIdx = nodes.findIndex(n => n.id === (originalId || id));
                if (existIdx >= 0) {
                    nodes[existIdx] = nodeObj;
                } else {
                    nodes.push(nodeObj);
                }

                saveNodesToServer(nodes);
            });
        }
    });
})();
