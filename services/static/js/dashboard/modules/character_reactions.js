document.addEventListener('DOMContentLoaded', () => {
    // ========== 导出角色 ==========
    const btnExportCharacter = document.getElementById('btn-export-character');
    if (btnExportCharacter) {
        btnExportCharacter.addEventListener('click', async () => {
            const exportMemory = document.getElementById('export-memory-chk').checked;
            const exportDatabank = document.getElementById('export-databank-chk').checked;
            const statusText = document.getElementById('export-status-text');
            
            btnExportCharacter.disabled = true;
            statusText.style.display = 'block';
            statusText.className = 'help-text';
            statusText.innerText = '正在封装，请稍候...';
            
            try {
                // Determine current active character
                const charRes = await fetch('/api/character_info');
                const charData = await charRes.json();
                const charId = charData.character_id;
                
                const response = await fetch('/api/characters/export', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        char_id: charId,
                        export_memory: exportMemory,
                        export_databank: exportDatabank
                    })
                });
                
                if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${charId}_export.zip`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                    
                    statusText.className = 'help-text text-success';
                    statusText.innerText = '打包完成并已触发下载！';
                } else {
                    const errData = await response.json();
                    statusText.className = 'help-text text-danger';
                    statusText.innerText = `导出失败: ${errData.message || '未知错误'}`;
                }
            } catch (e) {
                statusText.className = 'help-text text-danger';
                statusText.innerText = `导出异常: ${e.message}`;
            } finally {
                btnExportCharacter.disabled = false;
            }
        });
    }


});
