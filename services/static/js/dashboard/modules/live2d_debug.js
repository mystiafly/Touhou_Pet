// ==================== SPRITE SETTINGS LOGIC ====================
document.addEventListener('DOMContentLoaded', () => {
    const spriteView = document.getElementById('sprite-settings-view');
    if (!spriteView) return;

    const setSelect = document.getElementById('sprite-set-select');
    const btnSetActive = document.getElementById('set-active-sprite-btn');
    const btnCreateSet = document.getElementById('create-sprite-set-btn');

    function customPrompt(message, defaultValue = "") {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0'; overlay.style.left = '0';
            overlay.style.width = '100vw'; overlay.style.height = '100vh';
            overlay.style.backgroundColor = 'rgba(0,0,0,0.7)';
            overlay.style.zIndex = '9999';
            overlay.style.display = 'flex';
            overlay.style.justifyContent = 'center';
            overlay.style.alignItems = 'center';
            
            const box = document.createElement('div');
            box.style.background = '#282a36';
            box.style.padding = '20px';
            box.style.borderRadius = '8px';
            box.style.color = '#fff';
            box.style.minWidth = '300px';
            
            const text = document.createElement('div');
            text.textContent = message;
            text.style.marginBottom = '10px';
            
            const input = document.createElement('input');
            input.type = 'text';
            input.value = defaultValue;
            input.style.width = '100%';
            input.style.padding = '8px';
            input.style.marginBottom = '15px';
            input.style.background = '#1e1f29';
            input.style.color = '#fff';
            input.style.border = '1px solid #6272a4';
            input.style.boxSizing = 'border-box';
            
            const btnRow = document.createElement('div');
            btnRow.style.display = 'flex';
            btnRow.style.justifyContent = 'flex-end';
            btnRow.style.gap = '10px';
            
            const btnCancel = document.createElement('button');
            btnCancel.textContent = '取消';
            btnCancel.className = 'action-btn outline';
            btnCancel.onclick = () => { document.body.removeChild(overlay); resolve(null); };
            
            const btnOk = document.createElement('button');
            btnOk.textContent = '确定';
            btnOk.className = 'action-btn';
            btnOk.onclick = () => { document.body.removeChild(overlay); resolve(input.value); };
            
            btnRow.appendChild(btnCancel);
            btnRow.appendChild(btnOk);
            box.appendChild(text);
            box.appendChild(input);
            box.appendChild(btnRow);
            overlay.appendChild(box);
            document.body.appendChild(overlay);
            input.focus();
        });
    }

    const btnRenameSet = document.getElementById('rename-sprite-set-btn');

    const previewContainer = document.getElementById('sprite-preview-container');

    // Hook nav-item click to refresh sprite view
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const target = item.getAttribute('data-target');
            if (target === 'sprite-settings-view') {
                loadSpriteSets();
            }
        });
    });

    let hasLoadedSprites = false;
    async function loadSpriteSets() {
        try {
            const res = await fetch('/api/sprites/list');
            const data = await res.json();
            if (data.success) {
                const currentSelection = setSelect.value;
                renderSpriteSelect(data.sets, data.active_set);
                if (hasLoadedSprites && currentSelection && Object.keys(data.sets).includes(currentSelection)) {
                    setSelect.value = currentSelection;
                }
                hasLoadedSprites = true;
                renderSpriteGrid(data.sets, setSelect.value);
            }
        } catch (e) {
            console.error('Failed to load sprites', e);
        }
    }

    function renderSpriteSelect(sets, activeSet) {
        setSelect.innerHTML = '';
        Object.keys(sets).forEach(setName => {
            const opt = document.createElement('option');
            opt.value = setName;
            opt.textContent = setName + (setName === activeSet ? ' (当前使用)' : '');
            setSelect.appendChild(opt);
        });
        if (Object.keys(sets).includes(activeSet)) {
            setSelect.value = activeSet;
        }

        setSelect.onchange = () => {
            renderSpriteGrid(sets, setSelect.value);
        };
    }

    function renderSpriteGrid(sets, selectedSet) {
        const typeBadge = document.getElementById('sprite-set-type-badge');
        const live2dBox = document.getElementById('live2d-preview-box');
        const pngContainer = document.getElementById('png-sprite-container');
        const setData = sets[selectedSet];

        if (setData && setData.type === 'live2d') {
            if (typeBadge) {
                typeBadge.innerHTML = '💫 Live2D 动态模型 (Soullink 驱动)';
                typeBadge.style.background = 'rgba(189, 147, 249, 0.2)';
                typeBadge.style.color = '#bd93f9';
                typeBadge.style.borderColor = '#bd93f9';
            }
            if (live2dBox) live2dBox.classList.remove('hidden');
            if (pngContainer) pngContainer.classList.add('hidden');

            const canvas = document.getElementById('dashboard-live2d-canvas');
            if (canvas && setData.model_url) {
                const tryLoadLive2D = () => {
                    if (window.SoullinkLive2D) {
                        window.SoullinkLive2D.load(canvas, setData.model_url).then(() => {
                            const scale = setData.scale !== undefined ? setData.scale : 1.0;
                            const offX = setData.offset_x !== undefined ? setData.offset_x : 0.0;
                            const offY = setData.offset_y !== undefined ? setData.offset_y : 0.0;
                            window.SoullinkLive2D.setTransform(scale, offX, offY);

                            const scaleSlider = document.getElementById('live2d-scale-slider');
                            const scaleVal = document.getElementById('live2d-scale-val');
                            const offXSlider = document.getElementById('live2d-offset-x-slider');
                            const offXVal = document.getElementById('live2d-offset-x-val');
                            const offYSlider = document.getElementById('live2d-offset-y-slider');
                            const offYVal = document.getElementById('live2d-offset-y-val');

                            if (scaleSlider) scaleSlider.value = scale;
                            if (scaleVal) scaleVal.textContent = scale.toFixed(2) + 'x';
                            if (offXSlider) offXSlider.value = offX;
                            if (offXVal) offXVal.textContent = Math.round(offX) + 'px';
                            if (offYSlider) offYSlider.value = offY;
                            if (offYVal) offYVal.textContent = Math.round(offY) + 'px';
                        });
                    } else {
                        setTimeout(tryLoadLive2D, 100);
                    }
                };
                tryLoadLive2D();
            }
            return;
        }

        // 普通 PNG 套装
        if (typeBadge) {
            typeBadge.innerHTML = '🎨 普通 PNG 立绘';
            typeBadge.style.background = 'rgba(80, 250, 123, 0.2)';
            typeBadge.style.color = '#50fa7b';
            typeBadge.style.borderColor = '#50fa7b';
        }
        if (live2dBox) live2dBox.classList.add('hidden');
        if (pngContainer) pngContainer.classList.remove('hidden');

        previewContainer.innerHTML = '';
        const imagesDict = (setData && setData.images) ? setData.images : (sets[selectedSet] || {});
        
        const emotions = ['normal', 'angry', 'shy', 'crying', 'sleeping', 'peeking_left', 'peeking_right'];
        
        emotions.forEach(emotion => {
            const groupDiv = document.createElement('div');
            groupDiv.style.background = 'rgba(0,0,0,0.3)';
            groupDiv.style.padding = '15px';
            groupDiv.style.borderRadius = '8px';
            
            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.marginBottom = '10px';
            
            const title = document.createElement('h3');
            title.textContent = `情绪: ${emotion}`;
            title.style.margin = '0';
            title.style.color = '#ff79c6';
            
            const uploadBtn = document.createElement('button');
            uploadBtn.className = 'action-btn outline';
            uploadBtn.innerHTML = '<i class="fas fa-upload"></i> 上传立绘';
            uploadBtn.onclick = () => uploadSprites(selectedSet, emotion);
            
            header.appendChild(title);
            header.appendChild(uploadBtn);
            groupDiv.appendChild(header);
            
            const grid = document.createElement('div');
            grid.style.display = 'flex';
            grid.style.flexWrap = 'wrap';
            grid.style.gap = '10px';
            
            const imgs = imagesDict[emotion] || [];
            if (imgs.length === 0) {
                const empty = document.createElement('div');
                empty.textContent = '暂无立绘';
                empty.style.color = '#777';
                grid.appendChild(empty);
            } else {
                imgs.forEach(url => {
                    const imgContainer = document.createElement('div');
                    imgContainer.style.position = 'relative';
                    imgContainer.style.width = '100px';
                    imgContainer.style.height = '120px';
                    imgContainer.style.background = '#282a36';
                    imgContainer.style.borderRadius = '5px';
                    imgContainer.style.overflow = 'hidden';
                    
                    const img = document.createElement('img');
                    img.src = url + '?t=' + new Date().getTime(); // prevent cache
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'contain';
                    
                    const delBtn = document.createElement('button');
                    delBtn.innerHTML = '<i class="fas fa-trash"></i>';
                    delBtn.style.position = 'absolute';
                    delBtn.style.top = '5px';
                    delBtn.style.right = '5px';
                    delBtn.style.background = 'rgba(255,85,85,0.8)';
                    delBtn.style.color = 'white';
                    delBtn.style.border = 'none';
                    delBtn.style.borderRadius = '3px';
                    delBtn.style.cursor = 'pointer';
                    delBtn.style.padding = '5px';
                    
                    delBtn.onclick = () => deleteSprite(selectedSet, url.split('/').pop());
                    
                    imgContainer.appendChild(img);
                    imgContainer.appendChild(delBtn);
                    grid.appendChild(imgContainer);
                });
            }
            
            groupDiv.appendChild(grid);
            previewContainer.appendChild(groupDiv);
        });
    }

    async function uploadSprites(setName, emotion) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png';
        input.multiple = true;
        input.onchange = async (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;
            
            const formData = new FormData();
            formData.append('set_name', setName);
            formData.append('emotion', emotion);
            for(let i=0; i<files.length; i++) {
                formData.append('files', files[i]);
            }
            
            try {
                const res = await fetch('/api/sprites/upload', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (data.success) {
                    alert('上传成功！');
                    loadSpriteSets();
                } else {
                    alert('上传失败: ' + data.message);
                }
            } catch(err) {
                console.error(err);
                alert('上传错误');
            }
        };
        input.click();
    }

    async function deleteSprite(setName, filename) {
        if (!confirm(`确定要删除 ${filename} 吗？`)) return;
        
        try {
            const res = await fetch('/api/sprites/delete', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ set_name: setName, filename: filename })
            });
            const data = await res.json();
            if (data.success) {
                alert('删除成功！');
                loadSpriteSets();
            } else {
                alert('删除失败: ' + data.message);
            }
        } catch(err) {
            console.error(err);
            alert('删除错误');
        }
    }

    btnSetActive.addEventListener('click', async () => {
        const setName = setSelect.value;
        if (!setName) return;
        
        const confirmSet = await window.asyncConfirm(`确定要将当前使用的立绘套装切换为【${setName}】吗？\n为确保底层 Live2D 骨骼模型与表情图集彻底重新装载，系统将立即自动重启！`);
        if (!confirmSet) return;

        try {
            const res = await fetch('/api/sprites/set_active', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ set_name: setName })
            });
            const data = await res.json();
            if (data.success) {
                await window.triggerAppRestart(`立绘套装已成功更换为【${setName}】，正在重启桌宠系统...`);
            } else {
                alert('激活失败: ' + data.message);
            }
        } catch(err) {
            console.error(err);
            alert('激活发生异常: ' + err);
        }
    });

    if (btnRenameSet) {
        btnRenameSet.addEventListener('click', async () => {
            const oldName = setSelect.value;
            if (!oldName) return;
            const newName = await customPrompt(`请输入套装 '${oldName}' 的新名字：`, oldName);
            if (!newName || newName === oldName) return;
            
            try {
                const res = await fetch('/api/sprites/rename_set', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ old_name: oldName, new_name: newName })
                });
                const data = await res.json();
                if (data.success) {
                    alert('重命名成功！');
                    setSelect.value = newName;
                    loadSpriteSets();
                } else {
                    alert('重命名失败: ' + data.message);
                }
            } catch(err) {
                console.error(err);
                alert('重命名错误');
            }
        });
    }

    btnCreateSet.addEventListener('click', async () => {
        const newName = await customPrompt("请输入新套装的名字（仅限英文、数字、下划线）：", "new_outfit");
        if (!newName) return;
        
        try {
            const res = await fetch('/api/sprites/create_set', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ set_name: newName })
            });
            const data = await res.json();
            if (data.success) {
                alert('套装创建成功！');
                loadSpriteSets();
            } else {
                alert('创建失败: ' + data.message);
            }
        } catch(err) {
            console.error(err);
            alert('创建错误');
        }
    });

    // 绑定 Live2D 情绪测试按钮
    document.querySelectorAll('.btn-test-live2d-emotion').forEach(btn => {
        btn.addEventListener('click', () => {
            const emotion = btn.getAttribute('data-emotion');
            if (window.SoullinkLive2D && window.SoullinkLive2D.isLoaded) {
                window.SoullinkLive2D.setEmotion(emotion);
            }
        });
    });

    // 绑定 Live2D 预览画布鼠标视线跟随
    const dashboardLive2dCanvas = document.getElementById('dashboard-live2d-canvas');
    if (dashboardLive2dCanvas) {
        dashboardLive2dCanvas.addEventListener('mousemove', (e) => {
            if (window.SoullinkLive2D && window.SoullinkLive2D.isLoaded) {
                window.SoullinkLive2D.focus(e.clientX, e.clientY, dashboardLive2dCanvas);
            }
        });
        dashboardLive2dCanvas.addEventListener('mouseleave', () => {
            if (window.SoullinkLive2D && window.SoullinkLive2D.isLoaded) {
                window.SoullinkLive2D.targetFocusX = 0;
                window.SoullinkLive2D.targetFocusY = 0;
            }
        });
    }

    // 绑定 Live2D 剪裁缩放与微调滑块
    const scaleSlider = document.getElementById('live2d-scale-slider');
    const scaleVal = document.getElementById('live2d-scale-val');
    const offXSlider = document.getElementById('live2d-offset-x-slider');
    const offXVal = document.getElementById('live2d-offset-x-val');
    const offYSlider = document.getElementById('live2d-offset-y-slider');
    const offYVal = document.getElementById('live2d-offset-y-val');
    const btnResetTransform = document.getElementById('btn-reset-live2d-transform');
    const btnSaveTransform = document.getElementById('btn-save-live2d-transform');

    const updateLive2dTransform = () => {
        const scale = scaleSlider ? parseFloat(scaleSlider.value) : 1.0;
        const offX = offXSlider ? parseFloat(offXSlider.value) : 0.0;
        const offY = offYSlider ? parseFloat(offYSlider.value) : 0.0;

        if (scaleVal) scaleVal.textContent = scale.toFixed(2) + 'x';
        if (offXVal) offXVal.textContent = Math.round(offX) + 'px';
        if (offYVal) offYVal.textContent = Math.round(offY) + 'px';

        if (window.SoullinkLive2D && window.SoullinkLive2D.isLoaded) {
            window.SoullinkLive2D.setTransform(scale, offX, offY);
        }
    };

    if (scaleSlider) scaleSlider.addEventListener('input', updateLive2dTransform);
    if (offXSlider) offXSlider.addEventListener('input', updateLive2dTransform);
    if (offYSlider) offYSlider.addEventListener('input', updateLive2dTransform);

    if (btnResetTransform) {
        btnResetTransform.addEventListener('click', () => {
            if (scaleSlider) scaleSlider.value = 1.0;
            if (offXSlider) offXSlider.value = 0;
            if (offYSlider) offYSlider.value = 0;
            updateLive2dTransform();
        });
    }

    if (btnSaveTransform) {
        btnSaveTransform.addEventListener('click', async () => {
            const selectedSet = setSelect.value;
            if (!selectedSet) return;
            const scale = scaleSlider ? parseFloat(scaleSlider.value) : 1.0;
            const offX = offXSlider ? parseFloat(offXSlider.value) : 0.0;
            const offY = offYSlider ? parseFloat(offYSlider.value) : 0.0;

            btnSaveTransform.disabled = true;
            btnSaveTransform.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中';
            try {
                const res = await fetch('/api/sprites/live2d_config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        set_name: selectedSet,
                        scale: scale,
                        offset_x: offX,
                        offset_y: offY
                    })
                });
                const data = await res.json();
                if (data.success) {
                    btnSaveTransform.innerHTML = '<i class="fas fa-check"></i> 已保存';
                    setTimeout(() => {
                        btnSaveTransform.innerHTML = '<i class="fas fa-save"></i> 保存布局';
                        btnSaveTransform.disabled = false;
                    }, 1500);
                } else {
                    alert('保存失败: ' + (data.error || '未知错误'));
                    btnSaveTransform.disabled = false;
                    btnSaveTransform.innerHTML = '<i class="fas fa-save"></i> 保存布局';
                }
            } catch (e) {
                alert('请求失败: ' + e);
                btnSaveTransform.disabled = false;
                btnSaveTransform.innerHTML = '<i class="fas fa-save"></i> 保存布局';
            }
        });
    }

    // === Live2D 模型导入 Modal 逻辑 ===
    const openLive2dModalBtn = document.getElementById('open-import-live2d-modal-btn');
    const live2dModal = document.getElementById('live2d-import-modal');
    const closeLive2dModalBtn = document.getElementById('close-live2d-modal-btn');
    const cancelLive2dImportBtn = document.getElementById('btn-cancel-live2d-import');
    const chooseLive2dFileBtn = document.getElementById('btn-choose-live2d-file');
    const live2dFileInput = document.getElementById('live2d-file-input');
    const chosenLive2dFilename = document.getElementById('chosen-live2d-filename');
    const live2dLocalPathInput = document.getElementById('live2d-local-path-input');
    const live2dSetNameInput = document.getElementById('live2d-set-name-input');
    const submitLive2dImportBtn = document.getElementById('btn-submit-live2d-import');
    const live2dImportStatus = document.getElementById('live2d-import-status');

    if (openLive2dModalBtn && live2dModal) {
        openLive2dModalBtn.addEventListener('click', () => {
            live2dModal.classList.remove('hidden');
            if (live2dImportStatus) live2dImportStatus.style.display = 'none';
        });
    }

    const closeLive2dModal = () => {
        if (live2dModal) live2dModal.classList.add('hidden');
        if (live2dFileInput) live2dFileInput.value = '';
        if (chosenLive2dFilename) chosenLive2dFilename.textContent = '选择 .zip 模型压缩包...';
    };

    if (closeLive2dModalBtn) closeLive2dModalBtn.addEventListener('click', closeLive2dModal);
    if (cancelLive2dImportBtn) cancelLive2dImportBtn.addEventListener('click', closeLive2dModal);
    if (live2dModal) {
        live2dModal.addEventListener('click', (e) => {
            if (e.target === live2dModal) closeLive2dModal();
        });
    }

    if (chooseLive2dFileBtn && live2dFileInput) {
        chooseLive2dFileBtn.addEventListener('click', () => live2dFileInput.click());
        live2dFileInput.addEventListener('change', () => {
            if (live2dFileInput.files && live2dFileInput.files[0]) {
                const f = live2dFileInput.files[0];
                if (chosenLive2dFilename) chosenLive2dFilename.textContent = f.name;
                if (live2dSetNameInput && !live2dSetNameInput.value) {
                    live2dSetNameInput.value = f.name.replace(/\.[^/.]+$/, "");
                }
            }
        });
    }

    if (submitLive2dImportBtn) {
        submitLive2dImportBtn.addEventListener('click', async () => {
            const file = live2dFileInput ? live2dFileInput.files[0] : null;
            const localPath = live2dLocalPathInput ? live2dLocalPathInput.value.trim() : '';
            const setName = live2dSetNameInput ? live2dSetNameInput.value.trim() : '';

            if (!file && !localPath) {
                alert('请选择要上传的 .zip 文件，或输入本地文件绝对路径！');
                return;
            }

            submitLive2dImportBtn.disabled = true;
            submitLive2dImportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在解压并校验 Live2D 模型...';
            if (live2dImportStatus) {
                live2dImportStatus.style.display = 'block';
                live2dImportStatus.style.color = '#8be9fd';
                live2dImportStatus.textContent = '正在解压并检测 .model3.json 结构...';
            }

            try {
                const formData = new FormData();
                if (file) {
                    formData.append('file', file);
                }
                if (localPath) {
                    formData.append('zip_path', localPath);
                }
                if (setName) {
                    formData.append('set_name', setName);
                }

                const res = await fetch('/api/sprites/import_live2d', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();

                if (data.success) {
                    closeLive2dModal();
                    await window.triggerAppRestart(`🎉 恭喜！Live2D 模型套装「${data.set_name}」导入成功并已设为默认套装！\n系统正在重启以载入新模型...`);
                } else {
                    alert('导入失败: ' + (data.message || '未知错误'));
                }
            } catch (err) {
                console.error(err);
                alert('导入请求异常: ' + err.message);
            } finally {
                submitLive2dImportBtn.disabled = false;
                submitLive2dImportBtn.innerHTML = '<i class="fas fa-magic"></i> 开始导入并设为当前套装';
                if (live2dImportStatus) live2dImportStatus.style.display = 'none';
            }
        });
    }

    window.loadSpriteSets = loadSpriteSets;
});
