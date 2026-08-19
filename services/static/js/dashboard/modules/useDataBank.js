// useDataBank.js - 知识库、世界书与状态库动态表格编辑器模块
window.useDataBankModule = function(Vue) {
    const { ref, reactive, computed } = Vue;

    const dataBankRaw = ref({});
    const templateRaw = ref({});
    const currentSheetKey = ref(null);
    const isTemplateMode = ref(false);
    const isLoading = ref(false);

    // 行编辑模态框
    const editModal = reactive({
        visible: false,
        isNew: false,
        rowIndex: -1,
        headers: [],
        rowData: []
    });

    const sheetList = computed(() => {
        const source = isTemplateMode.value ? templateRaw.value : dataBankRaw.value;
        return Object.keys(source || {})
            .filter(k => k.startsWith('sheet_'))
            .map(k => ({
                key: k,
                name: source[k]?.name || k,
                sheet: source[k]
            }));
    });

    const currentSheet = computed(() => {
        if (!currentSheetKey.value) return null;
        const source = isTemplateMode.value ? templateRaw.value : dataBankRaw.value;
        return source[currentSheetKey.value] || null;
    });

    const currentHeaders = computed(() => {
        if (!currentSheet.value || !currentSheet.value.content || currentSheet.value.content.length === 0) {
            return [];
        }
        return currentSheet.value.content[0] || [];
    });

    const currentRows = computed(() => {
        if (!currentSheet.value || !currentSheet.value.content || currentSheet.value.content.length <= 1) {
            return [];
        }
        return currentSheet.value.content.slice(1);
    });

    async function loadDataBank() {
        isLoading.value = true;
        try {
            const res = await fetch('/api/databank');
            const data = await res.json();
            dataBankRaw.value = data || {};
            if (!currentSheetKey.value && sheetList.value.length > 0) {
                currentSheetKey.value = sheetList.value[0].key;
            }
        } catch (e) {
            console.error('加载 DataBank 失败:', e);
        } finally {
            isLoading.value = false;
        }
    }

    async function loadTemplate() {
        try {
            const res = await fetch('/api/databank/template');
            const data = await res.json();
            templateRaw.value = data || {};
        } catch (e) {
            console.error('加载 DataBank Template 失败:', e);
        }
    }

    function selectSheet(key) {
        currentSheetKey.value = key;
    }

    function openAddRowModal() {
        if (!currentHeaders.value.length) {
            alert('该表没有表头，无法添加数据');
            return;
        }
        editModal.isNew = true;
        editModal.rowIndex = -1;
        editModal.headers = [...currentHeaders.value];
        editModal.rowData = currentHeaders.value.map(() => '');
        editModal.visible = true;
    }

    function openEditRowModal(rowIndex) {
        const row = currentRows.value[rowIndex];
        if (!row) return;
        editModal.isNew = false;
        editModal.rowIndex = rowIndex;
        editModal.headers = [...currentHeaders.value];
        editModal.rowData = [...row];
        editModal.visible = true;
    }

    function saveRowModal() {
        if (!currentSheet.value) return;
        if (editModal.isNew) {
            currentSheet.value.content.push([...editModal.rowData]);
        } else if (editModal.rowIndex >= 0) {
            currentSheet.value.content[editModal.rowIndex + 1] = [...editModal.rowData];
        }
        editModal.visible = false;
    }

    async function deleteRow(rowIndex) {
        const confirmed = await window.asyncConfirm('确认删除此行数据吗？');
        if (!confirmed) return;
        if (currentSheet.value && currentSheet.value.content) {
            currentSheet.value.content.splice(rowIndex + 1, 1);
        }
    }

    async function saveDataBankContent() {
        if (!currentSheetKey.value || !currentSheet.value) return;
        try {
            const res = await fetch('/api/databank/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataBankRaw.value)
            });
            const data = await res.json();
            if (data.success) {
                alert('数据表保存成功！');
            } else {
                alert('保存失败: ' + (data.error || ''));
            }
        } catch (e) {
            alert('保存异常');
        }
    }

    return {
        dataBankRaw,
        templateRaw,
        currentSheetKey,
        isTemplateMode,
        isLoading,
        editModal,
        sheetList,
        currentSheet,
        currentHeaders,
        currentRows,
        loadDataBank,
        loadTemplate,
        selectSheet,
        openAddRowModal,
        openEditRowModal,
        saveRowModal,
        deleteRow,
        saveDataBankContent
    };
};
