// useMemory.js - 人格海向量记忆图谱、知识检索与记忆提炼模块
window.useMemoryModule = function(Vue) {
    const { ref, reactive } = Vue;

    const isLoadingGraph = ref(false);
    const graphSearchQuery = ref('');
    const selectedNode = ref(null);
    const isDistilling = ref(false);
    let networkInstance = null;
    let nodesDataSet = null;
    let edgesDataSet = null;

    async function loadMemoryGraph(containerId = 'graph-canvas-container') {
        const container = document.getElementById(containerId);
        if (!container) return;

        isLoadingGraph.value = true;
        selectedNode.value = null;

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

            nodesDataSet = new vis.DataSet(data.nodes || []);
            edgesDataSet = new vis.DataSet(data.edges || []);
            const graphData = { nodes: nodesDataSet, edges: edgesDataSet };

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
            networkInstance = new vis.Network(container, graphData, options);

            networkInstance.on('click', function(params) {
                if (params.nodes.length > 0) {
                    const nodeId = params.nodes[0];
                    const node = nodesDataSet.get(nodeId);
                    if (node) {
                        selectedNode.value = {
                            id: nodeId,
                            title: node.label || '记忆节点',
                            content: node.title || node.label || '暂无详细文本'
                        };
                    }
                } else {
                    selectedNode.value = null;
                }
            });

        } catch (error) {
            console.error('加载记忆图谱异常:', error);
            container.innerHTML = `<div style="color:#ff5555; padding: 30px; text-align:center;">网络连接超时，人格海无法拉取。</div>`;
        } finally {
            isLoadingGraph.value = false;
        }
    }

    function onSearchGraph() {
        if (!networkInstance || !nodesDataSet) return;
        const query = graphSearchQuery.value.trim().toLowerCase();
        if (!query) {
            networkInstance.unselectAll();
            return;
        }
        const matched = nodesDataSet.get().filter(n =>
            (n.label && n.label.toLowerCase().includes(query)) ||
            (n.title && n.title.toLowerCase().includes(query))
        );
        if (matched.length > 0) {
            networkInstance.selectNodes(matched.map(n => n.id));
            networkInstance.focus(matched[0].id, { scale: 1.2, animation: true });
        }
    }

    async function deleteSelectedNode() {
        if (!selectedNode.value) return;
        const confirmed = await window.asyncConfirm('确定要从人格海中彻底擦除该条记忆向量节点吗？此操作无法撤销。');
        if (!confirmed) return;

        try {
            const res = await fetch(`/api/settings/memory_node/${encodeURIComponent(selectedNode.value.id)}`, {
                method: 'DELETE'
            });
            const d = await res.json();
            if (d.success) {
                alert(d.message || '记忆节点已成功擦除');
                selectedNode.value = null;
                loadMemoryGraph();
            } else {
                alert('擦除失败: ' + d.error);
            }
        } catch (err) {
            alert('请求擦除失败');
        }
    }

    async function manualDistill(isTest = false) {
        if (!isTest) {
            const confirmed = await window.asyncConfirm('这将会消耗部分 API Token 将今天的聊天记录压缩为日记记忆实体，是否继续？');
            if (!confirmed) return;
        }

        isDistilling.value = true;
        try {
            const res = await fetch('/api/settings/memory_distill_now', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ seed_test: isTest })
            });
            const d = await res.json();
            if (d.success) {
                alert(d.message || '记忆提炼完成！');
                loadMemoryGraph();
            } else {
                alert('提炼失败: ' + (d.error || ''));
            }
        } catch (err) {
            alert('提炼请求异常');
        } finally {
            isDistilling.value = false;
        }
    }

    return {
        isLoadingGraph,
        graphSearchQuery,
        selectedNode,
        isDistilling,
        loadMemoryGraph,
        onSearchGraph,
        deleteSelectedNode,
        manualDistill
    };
};
