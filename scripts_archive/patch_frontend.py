import re
import os

SERVICES_DIR = r"g:\code\rumia\services"
PET_HTML = os.path.join(SERVICES_DIR, "templates", "pet.html")
PET_SCRIPT = os.path.join(SERVICES_DIR, "static", "js", "pet_script.js")

# 1. Patch pet.html
with open(PET_HTML, "r", encoding="utf-8") as f:
    html = f.read()

char_select_html = """
                    <div class="settings-item" style="margin-top: 15px;">
                        <label for="character-select">切换灵魂 (当前角色):</label>
                        <select id="character-select" class="settings-select">
                            <option value="rumia">露米娅 (Rumia)</option>
                            <option value="cirno">琪露诺 (Cirno) - 测试</option>
                        </select>
                    </div>
                    <p class="settings-desc">⚠️ 切换灵魂后，程序将会自动关闭以重置记忆引擎，请手动重新启动桌宠。</p>
"""

html = html.replace('                            <option value="deepseek-chat">DeepSeek V3 (标准版)</option>\n                        </select>\n                    </div>', 
                    '                            <option value="deepseek-chat">DeepSeek V3 (标准版)</option>\n                        </select>\n                    </div>' + char_select_html)

with open(PET_HTML, "w", encoding="utf-8") as f:
    f.write(html)


# 2. Patch pet_script.js
with open(PET_SCRIPT, "r", encoding="utf-8") as f:
    js = f.read()

# Replace hardcoded images and init in constructor
old_constructor = """
        // [修改] 升级为数组映射，每种情绪包含 3 张差分图
        this.images = {
            'normal': [
                '/static/images/rumia_normal.png',
                '/static/images/rumia_normal_1.png',
                '/static/images/rumia_normal_2.png'
            ],
            'angry': [
                '/static/images/rumia_angry.png',
                '/static/images/rumia_angry_1.png',
                '/static/images/rumia_angry_2.png'
            ],
            'shy': [
                '/static/images/rumia_shy.png',
                '/static/images/rumia_shy_1.png',
                '/static/images/rumia_shy_2.png'
            ],
            'crying': [
                '/static/images/rumia_crying.png',
                '/static/images/rumia_crying_1.png',
                '/static/images/rumia_crying_2.png'
            ],
            'sleeping': [
                '/static/images/rumia_sleeping.png',
                '/static/images/rumia_sleeping_1.png',
                '/static/images/rumia_sleeping_2.png'
            ]
        };

        // [新增] 预加载图片 (防止切换时闪烁)
        this.preloadImages();

        this.currentChatLog = "";
        this.currentRumiaDiary = "";
        this.activeLogTab = "chat"; // 'chat' 或 'diary'
        this.isSleeping = false;
        this.isMinimized = false;
        this.sleepTimer = null;

        // [新增] 网易云音乐原生播放器控制与状态绑定
        this.playerBar = document.getElementById('music-player-bar');
        this.inputBar = document.querySelector('.input-bar');
        this.musicTitle = document.getElementById('music-title');
        this.musicArtist = document.getElementById('music-artist');
        this.liveLyrics = document.getElementById('live-lyrics');
        this.musicToggleBtn = document.getElementById('music-toggle-btn');
        this.musicStopBtn = document.getElementById('music-stop-btn');

        this.musicAudio = new Audio();
        this.lyricsArray = [];
        this.musicIsPlaying = false;

        this.init();"""

new_constructor = """
        this.images = {};
        this.currentChatLog = "";
        this.currentRumiaDiary = "";
        this.activeLogTab = "chat"; // 'chat' 或 'diary'
        this.isSleeping = false;
        this.isMinimized = false;
        this.sleepTimer = null;

        this.playerBar = document.getElementById('music-player-bar');
        this.inputBar = document.querySelector('.input-bar');
        this.musicTitle = document.getElementById('music-title');
        this.musicArtist = document.getElementById('music-artist');
        this.liveLyrics = document.getElementById('live-lyrics');
        this.musicToggleBtn = document.getElementById('music-toggle-btn');
        this.musicStopBtn = document.getElementById('music-stop-btn');

        this.musicAudio = new Audio();
        this.lyricsArray = [];
        this.musicIsPlaying = false;

        this.loadCharacterInfo().then(() => {
            this.preloadImages();
            this.init();
        });"""

js = js.replace(old_constructor, new_constructor)

# Add loadCharacterInfo method
load_char_info = """
    async loadCharacterInfo() {
        try {
            const response = await fetch('/api/character_info');
            const data = await response.json();
            const prefix = data.image_path; // e.g. /static/images/rumia/
            this.images = {
                'normal': [prefix + 'normal.png', prefix + 'normal_1.png', prefix + 'normal_2.png'],
                'angry': [prefix + 'angry.png', prefix + 'angry_1.png', prefix + 'angry_2.png'],
                'shy': [prefix + 'shy.png', prefix + 'shy_1.png', prefix + 'shy_2.png'],
                'crying': [prefix + 'crying.png', prefix + 'crying_1.png', prefix + 'crying_2.png'],
                'sleeping': [prefix + 'sleeping.png', prefix + 'sleeping_1.png', prefix + 'sleeping_2.png']
            };
            this.img.src = this.images['normal'][0];
            
            // set select value
            const charSelect = document.getElementById('character-select');
            if (charSelect) {
                charSelect.value = data.character_id;
                charSelect.addEventListener('change', async (e) => {
                    const confirmSwitch = confirm(`确定要切换灵魂为 ${e.target.options[e.target.selectedIndex].text} 吗？\\n这将导致程序退出，您需要手动重新打开！`);
                    if (confirmSwitch) {
                        await fetch('/api/switch_character', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ character_id: e.target.value })
                        });
                        if (typeof require !== 'undefined') {
                            const { ipcRenderer } = require('electron');
                            ipcRenderer.send('exit-app');
                        } else {
                            window.close();
                        }
                    } else {
                        e.target.value = data.character_id; // revert
                    }
                });
            }
        } catch (e) {
            console.error("Failed to load character info", e);
        }
    }
"""

js = js.replace("    preloadImages() {", load_char_info + "\n    preloadImages() {")

with open(PET_SCRIPT, "w", encoding="utf-8") as f:
    f.write(js)

print("Frontend patching complete.")
