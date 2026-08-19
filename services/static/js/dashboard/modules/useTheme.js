// useTheme.js - 主题配色、个性化背景与 Wallpaper Engine 壁纸管理模块
window.useThemeModule = function(Vue) {
    const { ref, reactive, onMounted } = Vue;

    const themeColor = ref('#ff79c6');
    const bgColor = ref('#12121a');
    const customThemeColor = ref('#ff79c6');
    const customBgColor = ref('#12121a');
    const isSavedToast = ref(false);

    // Wallpaper Engine 相关状态
    const weScanning = ref(false);
    const weScanStatus = ref('');
    const weStatusType = ref('info'); // 'info' | 'success' | 'warning' | 'error'
    const weCustomPath = ref('');
    const weWallpapers = ref([]);
    const currentWallpaper = ref('');
    const currentWallpaperFit = ref('cover');

    function applyDashboardThemeColor(hex) {
        if (!/^#[0-9A-Fa-f]{6}$/i.test(hex)) return;
        themeColor.value = hex;

        let r = parseInt(hex.substring(1, 3), 16);
        let g = parseInt(hex.substring(3, 5), 16);
        let b = parseInt(hex.substring(5, 7), 16);

        let hr = Math.max(0, r - 32);
        let hg = Math.max(0, g - 32);
        let hb = Math.max(0, b - 32);

        document.documentElement.style.setProperty('--accent', hex);
        document.documentElement.style.setProperty('--accent-hover', `rgb(${hr}, ${hg}, ${hb})`);
        document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.3)`);
    }

    function applyDashboardBgColor(hex) {
        if (!/^#[0-9A-Fa-f]{6}$/i.test(hex)) return;
        bgColor.value = hex;

        let r = parseInt(hex.substring(1, 3), 16);
        let g = parseInt(hex.substring(3, 5), 16);
        let b = parseInt(hex.substring(5, 7), 16);

        let lightness = (r * 299 + g * 587 + b * 114) / 1000;
        let isLight = lightness > 128;

        document.documentElement.style.setProperty('--bg-dark', hex);
        document.body.style.backgroundColor = hex;

        if (isLight) {
            document.documentElement.style.setProperty('--text-main', '#1a1a24');
            document.documentElement.style.setProperty('--text-muted', '#6a6a7a');
            document.documentElement.style.setProperty('--border-color', 'rgba(0, 0, 0, 0.08)');

            let pr = Math.min(255, r + 10);
            let pg = Math.min(255, g + 10);
            let pb = Math.min(255, b + 10);
            document.documentElement.style.setProperty('--bg-panel', `rgb(${pr}, ${pg}, ${pb})`);
            document.documentElement.style.setProperty('--bg-card', '#ffffff');
        } else {
            document.documentElement.style.setProperty('--text-main', '#f0f0f0');
            document.documentElement.style.setProperty('--text-muted', '#a0a0b0');
            document.documentElement.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.08)');

            let pr = Math.min(255, r + 12);
            let pg = Math.min(255, g + 12);
            let pb = Math.min(255, b + 12);
            document.documentElement.style.setProperty('--bg-panel', `rgb(${pr}, ${pg}, ${pb})`);

            let cr = Math.min(255, r + 24);
            let cg = Math.min(255, g + 24);
            let cb = Math.min(255, b + 24);
            document.documentElement.style.setProperty('--bg-card', `rgb(${cr}, ${cg}, ${cb})`);
        }
    }

    function saveThemeColor(color) {
        applyDashboardThemeColor(color);
        fetch('/api/settings/config', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ theme_color: color })
        }).catch(e => console.error(e));
    }

    function saveBgColor(color) {
        applyDashboardBgColor(color);
        localStorage.setItem('dashboard_bg_color', color);
        isSavedToast.value = true;
        setTimeout(() => { isSavedToast.value = false; }, 1500);
    }

    // Wallpaper Engine 扫描
    async function scanWEWallpapers(customPath = '') {
        weScanning.value = true;
        weStatusType.value = 'info';
        weScanStatus.value = '正在扫描 Steam 创意工坊壁纸中...';

        try {
            const url = customPath ? `/api/wallpaper_engine/scan?custom_path=${encodeURIComponent(customPath)}` : '/api/wallpaper_engine/scan';
            const res = await fetch(url);
            const data = await res.json();

            if (data.success && data.items && data.items.length > 0) {
                if (data.scanned_path && !weCustomPath.value) {
                    weCustomPath.value = data.scanned_path;
                }
                weWallpapers.value = data.items;
                weStatusType.value = 'success';
                weScanStatus.value = `已找到 ${data.items.length} 个创意工坊壁纸 (检索路径: ${data.scanned_path})`;
            } else {
                weWallpapers.value = [];
                weStatusType.value = 'warning';
                weScanStatus.value = '未在该路径找到 Steam 壁纸文件，请尝试在上方输入自定义 Workshop 路径';
            }
        } catch (err) {
            console.error('扫描 WE 壁纸失败:', err);
            weStatusType.value = 'error';
            weScanStatus.value = '扫描失败，请检查网络或路径';
        } finally {
            weScanning.value = false;
        }
    }

    async function selectWEWallpaper(item) {
        let mode = 'image';
        let mediaUrl = item.media_url || item.preview_url;
        let wallpaperUrl = item.preview_url;
        let bgmUrl = item.extracted_bgm_url || '';
        let noteText = '';

        if (item.type === 'video') {
            mode = 'video';
            noteText = '已成功设置为【沙盒视频壁纸】！在桌宠沉浸模式内独立全屏播放 60 帧视频，绝不影响或修改你系统原本的桌面壁纸！';
        } else if (item.type === 'web') {
            mode = 'web';
            noteText = '已成功设置为【沙盒网页壁纸】！在桌宠沉浸模式内独立全屏渲染 WebGL 特效，绝不修改你系统原本的桌面壁纸！';
        } else if (item.type === 'scene') {
            if (!item.extracted_bg_url) {
                try {
                    const unpackRes = await fetch('/api/wallpaper_engine/unpack', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ folder_path: item.folder_path })
                    });
                    const unpackData = await unpackRes.json();
                    if (unpackData.success) {
                        item.extracted_bg_url = unpackData.extracted_bg_url;
                        item.extracted_bgm_url = unpackData.extracted_bgm_url;
                    }
                } catch (e) {
                    console.error('按需解包失败:', e);
                }
            }

            mode = 'scene_extracted';
            wallpaperUrl = item.extracted_bg_url || item.preview_url;
            mediaUrl = wallpaperUrl;
            bgmUrl = item.extracted_bgm_url || '';
            noteText = '已成功设置为【沙盒 4K 极清动态场景壁纸】！\n\n自动在桌宠全屏舞台中呈现 4K 无损底图 + 流星与群星特效 + 原版 BGM 音频！';
        } else {
            mode = 'image';
            mediaUrl = item.preview_url;
            noteText = '已成功设置为【沙盒图片壁纸】。';
        }

        try {
            const res = await fetch('/api/character/save_immersive_config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    immersive_bg_mode: mode,
                    immersive_media_url: mediaUrl,
                    immersive_wallpaper: wallpaperUrl,
                    immersive_bgm_url: bgmUrl
                })
            });
            const data = await res.json();
            if (data.success) {
                currentWallpaper.value = wallpaperUrl;
                alert(`已成功选择壁纸《${item.title}》！\n\n${noteText}`);
            }
        } catch (err) {
            console.error('保存 WE 壁纸配置失败:', err);
        }
    }

    async function setTransparentMode() {
        try {
            const res = await fetch('/api/character/save_immersive_config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ immersive_bg_mode: 'transparent' })
            });
            const data = await res.json();
            if (data.success) {
                alert('已成功切换为“桌面透明透传模式”！在沉浸模式下背景将保持透明，透传桌面正在运行的 Wallpaper Engine 动态动画。');
            }
        } catch (err) {
            console.error('保存透明模式失败:', err);
        }
    }

    function initTheme() {
        const savedBg = localStorage.getItem('dashboard_bg_color') || '#12121a';
        applyDashboardBgColor(savedBg);
        scanWEWallpapers();
    }

    return {
        themeColor,
        bgColor,
        customThemeColor,
        customBgColor,
        isSavedToast,
        weScanning,
        weScanStatus,
        weStatusType,
        weCustomPath,
        weWallpapers,
        currentWallpaper,
        currentWallpaperFit,
        applyDashboardThemeColor,
        applyDashboardBgColor,
        saveThemeColor,
        saveBgColor,
        scanWEWallpapers,
        selectWEWallpaper,
        setTransparentMode,
        initTheme
    };
};
