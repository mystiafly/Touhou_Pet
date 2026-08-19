// useLive2DDebug.js - Live2D 模型实时渲染调试、视线追踪与微调变换模块
window.useLive2DDebugModule = function(Vue) {
    const { ref, reactive, watch } = Vue;

    const live2dTransform = reactive({
        scale: 1.0,
        offsetX: 0.0,
        offsetY: 0.0
    });
    const isSavingTransform = ref(false);

    function applyTransformToEngine() {
        if (window.SoullinkLive2D && window.SoullinkLive2D.isLoaded) {
            window.SoullinkLive2D.setTransform(
                live2dTransform.scale,
                live2dTransform.offsetX,
                live2dTransform.offsetY
            );
        }
    }

    function resetTransform() {
        live2dTransform.scale = 1.0;
        live2dTransform.offsetX = 0.0;
        live2dTransform.offsetY = 0.0;
        applyTransformToEngine();
    }

    async function saveTransform(setName) {
        if (!setName) return;
        isSavingTransform.value = true;
        try {
            const res = await fetch('/api/sprites/live2d_config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    set_name: setName,
                    scale: live2dTransform.scale,
                    offset_x: live2dTransform.offsetX,
                    offset_y: live2dTransform.offsetY
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('Live2D 画面变换参数保存成功！');
            } else {
                alert('保存失败: ' + data.message);
            }
        } catch (e) {
            alert('保存异常');
        } finally {
            isSavingTransform.value = false;
        }
    }

    function testEmotion(emotion) {
        if (window.SoullinkLive2D && window.SoullinkLive2D.isLoaded) {
            window.SoullinkLive2D.setEmotion(emotion);
        }
    }

    function testTapMotion() {
        if (window.SoullinkLive2D && window.SoullinkLive2D.isLoaded) {
            window.SoullinkLive2D.triggerTapMotion();
        }
    }

    function testDragMotion() {
        if (window.SoullinkLive2D && window.SoullinkLive2D.isLoaded) {
            window.SoullinkLive2D.triggerDragMotion(10, 5);
        }
    }

    function testSpecialMotion() {
        if (window.SoullinkLive2D && window.SoullinkLive2D.isLoaded) {
            window.SoullinkLive2D.triggerSpecialMotion();
        }
    }

    function testIdleMotion() {
        if (window.SoullinkLive2D && window.SoullinkLive2D.isLoaded) {
            window.SoullinkLive2D.triggerIdleMotion();
        }
    }

    return {
        live2dTransform,
        isSavingTransform,
        applyTransformToEngine,
        resetTransform,
        saveTransform,
        testEmotion,
        testTapMotion,
        testDragMotion,
        testSpecialMotion,
        testIdleMotion
    };
};
