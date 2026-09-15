// 快捷键设置：负责编辑全局快捷键，并把配置同步给 Electron 主进程。
(function () {
    const ACTIONS = {
        read_process: '读取当前进程',
        clean_memory: '内存清理',
        analyze_screen: '视觉识图',
        send_text: '发送预制文本'
    };

    const state = { bindings: [] };

    function createElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function setStatus(message, isError) {
        const status = document.getElementById('quick-shortcuts-status');
        if (!status) return;
        status.textContent = message || '';
        status.style.color = isError ? 'var(--danger)' : 'var(--success)';
    }

    function normalizeKey(key, code) {
        const aliases = {
            ' ': 'Space', Escape: 'Esc', ArrowUp: 'Up', ArrowDown: 'Down',
            ArrowLeft: 'Left', ArrowRight: 'Right', PageUp: 'PageUp', PageDown: 'PageDown',
            Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert', Enter: 'Enter',
            Tab: 'Tab', Home: 'Home', End: 'End'
        };
        if (aliases[key]) return aliases[key];
        if (/^F([1-9]|1[0-9]|2[0-4])$/i.test(key)) return key.toUpperCase();
        if (key && key.length === 1) return key.toUpperCase();
        if (code && /^Numpad\d$/.test(code)) return code.replace('Numpad', 'Num');
        return key || '';
    }

    function captureAccelerator(event, input) {
        event.preventDefault();
        event.stopPropagation();
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return;

        const modifiers = [];
        if (event.ctrlKey) modifiers.push('CommandOrControl');
        if (event.altKey) modifiers.push('Alt');
        if (event.shiftKey) modifiers.push('Shift');
        if (event.metaKey && !event.ctrlKey) modifiers.push('Super');
        const key = normalizeKey(event.key, event.code);
        if (!key) return;
        if (!modifiers.length && !/^F([1-9]|1[0-9]|2[0-4])$/i.test(key)) {
            setStatus('快捷键至少需要 Ctrl、Alt、Shift 中的一个，或使用 F1-F24。', true);
            return;
        }
        input.value = modifiers.concat(key).join('+');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        setStatus('组合键已录入，保存后立即生效。', false);
    }

    function addField(parent, labelText, control) {
        const field = createElement('div', 'quick-shortcut-field');
        const label = createElement('label', '', labelText);
        field.append(label, control);
        parent.appendChild(field);
        return field;
    }

    function render() {
        const list = document.getElementById('quick-shortcuts-list');
        if (!list) return;
        list.replaceChildren();

        if (!state.bindings.length) {
            list.appendChild(createElement('div', 'quick-shortcuts-empty', '还没有快捷键，点击“添加快捷键”开始设置。'));
            return;
        }

        state.bindings.forEach((binding, index) => {
            const row = createElement('div', 'quick-shortcut-row');
            const grid = createElement('div', 'quick-shortcut-grid');

            const nameInput = createElement('input', 'quick-shortcut-input');
            nameInput.type = 'text';
            nameInput.maxLength = 40;
            nameInput.placeholder = '例如：查看进程';
            nameInput.value = binding.name || '';
            nameInput.addEventListener('input', () => { binding.name = nameInput.value; });
            addField(grid, '名称', nameInput);

            const shortcutWrap = createElement('div', 'quick-shortcut-field');
            const shortcutLabel = createElement('label', '', '组合键');
            const shortcutLine = createElement('div');
            shortcutLine.style.display = 'flex';
            shortcutLine.style.gap = '6px';
            const shortcutInput = createElement('input', 'quick-shortcut-input quick-shortcut-accelerator');
            shortcutInput.type = 'text';
            shortcutInput.readOnly = true;
            shortcutInput.placeholder = '点击后按组合键';
            shortcutInput.title = '点击后按下 Ctrl/Alt/Shift 加任意按键';
            shortcutInput.value = binding.accelerator || '';
            shortcutInput.addEventListener('keydown', (event) => captureAccelerator(event, shortcutInput));
            shortcutInput.addEventListener('input', () => { binding.accelerator = shortcutInput.value; });
            const clearButton = createElement('button', 'quick-shortcut-remove', '清空');
            clearButton.type = 'button';
            clearButton.style.padding = '0 8px';
            clearButton.addEventListener('click', () => {
                shortcutInput.value = '';
                binding.accelerator = '';
                shortcutInput.focus();
            });
            shortcutLine.append(shortcutInput, clearButton);
            shortcutWrap.append(shortcutLabel, shortcutLine);
            grid.appendChild(shortcutWrap);

            const actionSelect = createElement('select', 'modern-select');
            Object.entries(ACTIONS).forEach(([value, label]) => {
                const option = createElement('option', '', label);
                option.value = value;
                actionSelect.appendChild(option);
            });
            actionSelect.value = ACTIONS[binding.action] ? binding.action : 'read_process';
            binding.action = actionSelect.value;
            addField(grid, '触发动作', actionSelect);

            const textInput = createElement('textarea', 'quick-shortcut-text');
            textInput.rows = 1;
            textInput.maxLength = 2000;
            textInput.placeholder = '仅“发送预制文本”需要填写，例如：请简要总结当前屏幕内容。';
            textInput.value = binding.text || '';
            textInput.addEventListener('input', () => { binding.text = textInput.value; });
            const textField = addField(grid, '预制文本', textInput);

            const toggleField = createElement('div', 'quick-shortcut-field');
            const toggleLabel = createElement('label', '', '状态');
            const toggle = createElement('label', 'quick-shortcut-toggle');
            const checkbox = createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = binding.enabled !== false;
            checkbox.addEventListener('change', () => { binding.enabled = checkbox.checked; });
            toggle.append(checkbox, createElement('span', '', '启用'));
            toggleField.append(toggleLabel, toggle);
            grid.appendChild(toggleField);

            const removeButton = createElement('button', 'quick-shortcut-remove', '删除');
            removeButton.type = 'button';
            removeButton.title = `删除第 ${index + 1} 条快捷键`;
            removeButton.addEventListener('click', () => {
                state.bindings.splice(index, 1);
                render();
            });
            grid.appendChild(removeButton);
            row.appendChild(grid);

            const updateTextVisibility = () => {
                const isCustomText = actionSelect.value === 'send_text';
                textField.style.opacity = isCustomText ? '1' : '0.55';
                textInput.disabled = !isCustomText;
            };
            actionSelect.addEventListener('change', () => {
                binding.action = actionSelect.value;
                updateTextVisibility();
            });
            updateTextVisibility();
            list.appendChild(row);
        });
    }

    function addShortcut() {
        state.bindings.push({
            id: `shortcut-${Date.now()}-${state.bindings.length + 1}`,
            name: '',
            accelerator: '',
            action: 'read_process',
            text: '',
            enabled: true
        });
        render();
        const inputs = document.querySelectorAll('#quick-shortcuts-list .quick-shortcut-input');
        if (inputs.length) inputs[inputs.length - 2].focus();
    }

    async function saveShortcuts() {
        const saveButton = document.getElementById('save-quick-shortcuts-btn');
        const seen = new Set();
        for (const binding of state.bindings) {
            binding.name = String(binding.name || '').trim();
            binding.accelerator = String(binding.accelerator || '').trim();
            if (!binding.name || !binding.accelerator) {
                setStatus('每条快捷键都必须填写名称和组合键。', true);
                return;
            }
            const key = binding.accelerator.toLowerCase();
            if (seen.has(key)) {
                setStatus(`快捷键“${binding.accelerator}”重复绑定，请修改后再保存。`, true);
                return;
            }
            seen.add(key);
            if (binding.action === 'send_text' && !String(binding.text || '').trim()) {
                setStatus(`“${binding.name}”还没有填写预制文本。`, true);
                return;
            }
        }

        if (saveButton) saveButton.disabled = true;
        setStatus('正在保存并注册快捷键...', false);
        try {
            const response = await fetch('/api/settings/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quick_shortcuts: state.bindings })
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || data.error || '配置保存失败');

            if (window.__petIPC && window.__petIPC.setQuickShortcuts) {
                const result = await window.__petIPC.setQuickShortcuts(state.bindings);
                if (result && result.failed && result.failed.length) {
                    const failed = result.failed.map(item => `${item.name}（${item.accelerator}）`).join('、');
                    setStatus(`配置已保存，但以下快捷键注册失败：${failed}`, true);
                    return;
                }
            }
            setStatus(state.bindings.length ? '快捷键已保存并立即生效。' : '快捷键已清空。', false);
        } catch (error) {
            setStatus(`保存失败：${error.message}`, true);
        } finally {
            if (saveButton) saveButton.disabled = false;
        }
    }

    async function loadShortcuts() {
        const list = document.getElementById('quick-shortcuts-list');
        if (!list) return;
        try {
            const response = await fetch('/api/settings/config');
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || '配置读取失败');
            state.bindings = Array.isArray(data.quick_shortcuts) ? data.quick_shortcuts : [];
            render();
        } catch (error) {
            setStatus(`快捷键配置读取失败：${error.message}`, true);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const addButton = document.getElementById('add-quick-shortcut-btn');
        const saveButton = document.getElementById('save-quick-shortcuts-btn');
        if (!addButton || !saveButton) return;
        addButton.addEventListener('click', addShortcut);
        saveButton.addEventListener('click', saveShortcuts);
        loadShortcuts();
    });
})();
