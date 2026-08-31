document.addEventListener('DOMContentLoaded', () => {
    // ========== 人格海 (RAG记忆向量星图) ==========
    let network = null;
    let selectedNodeId = null;
    const manualDistillBtn = document.getElementById('manual-distill-btn');
    const seedTestBtn = document.getElementById('seed-test-btn');
    const refreshGraphBtn = document.getElementById('refresh-graph-btn');
    const deleteNodeBtn = document.getElementById('delete-node-btn');
    const graphSearchInput = document.getElementById('graph-search-input');
    const infoCard = document.getElementById('graph-info-card');
    const infoTitle = document.getElementById('info-node-title');
    const infoContent = document.getElementById('info-node-content');

    async function loadMemoryGraph() {
        const container = document.getElementById('graph-canvas-container');
        if (!container) return;

        container.innerHTML = '<div style="color:#8be9fd; padding: 40px; text-align:center; font-size:1.1em;"><i class="fas fa-spinner fa-spin"></i> 正在潜入人格海，扫描向量神经网络分布...</div>';
        
        try {
            const response = await fetch('/api/settings/memory_graph');
            const data = await response.json();

            if (!data.success) {
                container.innerHTML = `<div style="color:#ff5555; padding: 30px; text-align:center;">人格海星图读取失败: ${data.error}</div>`;
                return;
            }

            if (!data.nodes || data.nodes.length === 0) {
                container.innerHTML = `
                    <div style="color: #8be9fd; padding: 60px 20px; text-align: center;">
                        <i class="fas fa-water" style="font-size: 3em; color: rgba(139,233,253,0.4); margin-bottom: 15px;"></i>
                        <h3 style="margin: 5px 0;">当前角色人格海尚处于沉睡状态（0 个记忆节点）</h3>
                        <p style="color: #aaa; font-size: 0.9em;">快去和桌宠聊聊天，或者点击上方【注入测试回忆】唤醒她的人格海星图吧！</p>
                    </div>`;
                return;
            }

            const nodes = new vis.DataSet(data.nodes || []);
            const edges = new vis.DataSet(data.edges || []);
            const graphData = { nodes: nodes, edges: edges };

            const options = {
                nodes: {
                    borderWidth: 2,
                    font: { face: 'Segoe UI, Microsoft YaHei' }
                },
                edges: {
                    width: 2,
                    smooth: { type: 'continuous' }
                },
                physics: {
                    barnesHut: { gravitationalConstant: -2500, centralGravity: 0.3, springLength: 110, springConstant: 0.04 },
                    minVelocity: 0.75
                },
                interaction: { hover: true, tooltipDelay: 150 }
            };

            container.innerHTML = '';
            network = new vis.Network(container, graphData, options);

            network.on("click", function (params) {
                if (params.nodes.length > 0) {
                    selectedNodeId = params.nodes[0];
                    const node = nodes.get(selectedNodeId);
                    if (node) {
                        infoCard.classList.remove('hidden');
                        infoTitle.innerText = node.label || '记忆节点';
                        infoContent.innerText = node.title || node.label || '暂无详细文本';
                    }
                } else {
                    selectedNodeId = null;
                    infoCard.classList.add('hidden');
                }
            });

            // 搜索过滤支持
            if (graphSearchInput) {
                graphSearchInput.oninput = () => {
                    const query = graphSearchInput.value.trim().lower();
                    if (!query) return;
                    const matchedNodes = nodes.get().filter(n => 
                        (n.label && n.label.toLowerCase().includes(query)) || 
                        (n.title && n.title.toLowerCase().includes(query))
                    );
                    if (matchedNodes.length > 0) {
                        network.selectNodes(matchedNodes.map(n => n.id));
                        network.focus(matchedNodes[0].id, { scale: 1.2, animation: true });
                    }
                };
            }

        } catch (error) {
            container.innerHTML = `<div style="color:#ff5555; padding: 30px; text-align:center;">网络连接超时，人格海无法拉取。</div>`;
        }
    }

    if (refreshGraphBtn) refreshGraphBtn.addEventListener('click', loadMemoryGraph);

    if (deleteNodeBtn) {
        deleteNodeBtn.addEventListener('click', async () => {
            if (!selectedNodeId) return;
            if (!await window.asyncConfirm("确定要从人格海中彻底擦除该条记忆向量节点吗？此操作无法撤销。")) return;
            try {
                const res = await fetch(`/api/settings/memory_node/${encodeURIComponent(selectedNodeId)}`, { method: 'DELETE' });
                const d = await res.json();
                if (d.success) {
                    alert(d.message);
                    infoCard.classList.add('hidden');
                    selectedNodeId = null;
                    loadMemoryGraph();
                } else {
                    alert("擦除失败: " + d.error);
                }
            } catch (err) {
                alert("请求擦除失败!");
            }
        });
    }

    async function manualDistill(isTest = false) {
        if (!isTest && !await window.asyncConfirm("这将会消耗部分 API Token 将今天的聊天记录压缩为日记记忆实体，是否继续？")) return;
        
        const btn = isTest ? seedTestBtn : manualDistillBtn;
        if (!btn) return;
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在处理...';
        btn.disabled = true;

        try {
            const res = await fetch('/api/settings/memory_distill_now', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ seed_test: isTest })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                loadMemoryGraph();
            } else {
                alert("失败: " + data.error);
            }
        } catch (e) {
            alert("请求异常！");
        } finally {
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
    }

    if (manualDistillBtn) manualDistillBtn.addEventListener('click', () => manualDistill(false));
    if (seedTestBtn) seedTestBtn.addEventListener('click', () => manualDistill(true));

    // 绑定 Nav Item 点击自动加载人格海
    const graphNavItem = document.querySelector('.nav-item[data-target="graph-view"]');
    if (graphNavItem) {
        graphNavItem.addEventListener('click', () => {
            setTimeout(loadMemoryGraph, 100);
        });
    }

    window.loadMemoryGraph = typeof loadMemoryGraph !== 'undefined' ? loadMemoryGraph : null;
});
