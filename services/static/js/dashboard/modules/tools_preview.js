document.addEventListener('DOMContentLoaded', () => {
    // ========== 工具设置加载 ==========
    window.loadToolsList = async function() {
        const container = document.getElementById('tools-container');
        if (!container) return;

        try {
            const response = await fetch('/api/tools');
            const data = await response.json();

            if (data.status === 'success' && data.tools) {
                container.innerHTML = ''; // 清空

                data.tools.forEach(tool => {
                    const card = document.createElement('div');
                    card.className = 'tool-card';
                    card.style.cssText = `
                        background: rgba(30, 32, 40, 0.6);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 12px;
                        padding: 20px;
                        display: flex;
                        flex-direction: column;
                        transition: all 0.3s ease;
                        backdrop-filter: blur(10px);
                        position: relative;
                        overflow: hidden;
                    `;

                    // Hover effect (inline setup since we lack external CSS definition for .tool-card hover easily here)
                    card.onmouseenter = () => {
                        card.style.transform = 'translateY(-5px)';
                        card.style.borderColor = 'var(--accent-color)';
                        card.style.boxShadow = '0 10px 20px rgba(0,0,0,0.3)';
                    };
                    card.onmouseleave = () => {
                        card.style.transform = 'translateY(0)';
                        card.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                        card.style.boxShadow = 'none';
                    };

                    card.innerHTML = `
                        <div style="display: flex; align-items: center; margin-bottom: 12px; color: var(--accent-color);">
                            <i class="${tool.icon} fa-fw" style="font-size: 24px; margin-right: 12px;"></i>
                            <h3 style="margin: 0; font-size: 18px; font-weight: 600;">${tool.name}</h3>
                        </div>
                        <div style="background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 6px; margin-bottom: 15px; font-family: monospace; font-size: 13px; color: #4ade80; border-left: 3px solid #4ade80;">
                            ${tool.command}
                        </div>
                        <p style="color: #a0a0a0; font-size: 14px; line-height: 1.5; margin: 0; flex-grow: 1;">
                            ${tool.description}
                        </p>
                    `;
                    
                    if (tool.command.startsWith('[LAUNCH_APP')) {
                        card.style.cursor = 'pointer';
                        card.title = '点击配置应用启动白名单';
                        card.addEventListener('click', async () => {
                            try {
                                const cfgRes = await fetch('/api/settings/config');
                                const cfgData = await cfgRes.json();
                                if (cfgData.success) {
                                    window.currentAppLauncherConfig = cfgData.app_launcher || {};
                                    window.renderAppLauncherList();
                                    document.getElementById('app-launcher-modal').classList.remove('hidden');
                                }
                            } catch (e) {
                                alert('获取配置失败：' + e);
                            }
                        });
                    } else if (tool.command.startsWith('[ANALYZE_SCREEN')) {
                        card.style.cursor = 'pointer';
                        card.title = '点击配置视觉识别引擎';
                        card.addEventListener('click', () => {
                            document.getElementById('vision-tool-modal').classList.remove('hidden');
                        });
                    } else if (tool.command.startsWith('[WEATHER')) {
                        card.style.cursor = 'pointer';
                        card.title = '点击配置天气服务商、地区与经纬度';
                        card.addEventListener('click', async () => {
                            try {
                                const cfgRes = await fetch('/api/settings/config');
                                const cfgData = await cfgRes.json();
                                if (cfgData.success) {
                                    window.openWeatherModal(cfgData);
                                }
                            } catch (e) {
                                alert('获取天气配置失败：' + e);
                            }
                        });
                    }

                    container.appendChild(card);
                });

                // 城市经纬度字典
                const CITY_COORDS_MAP = {
                    "北京": [39.9042, 116.4074],
                    "上海": [31.2304, 121.4737],
                    "广州": [23.1291, 113.2644],
                    "深圳": [22.5431, 114.0579],
                    "杭州": [30.2741, 120.1551],
                    "南京": [32.0603, 118.7969],
                    "成都": [30.5728, 104.0668],
                    "武汉": [30.5928, 114.3055],
                    "重庆": [29.5630, 106.5516],
                    "西安": [34.3416, 108.9398],
                    "天津": [39.0842, 117.2008],
                    "苏州": [31.2990, 120.5853],
                    "长沙": [28.2282, 112.9388],
                    "郑州": [34.7466, 113.6253],
                    "青岛": [36.0671, 120.3826],
                    "合肥": [31.8206, 117.2272],
                    "福州": [26.0745, 119.2965],
                    "厦门": [24.4798, 118.0894],
                    "昆明": [24.8801, 102.8329],
                    "沈阳": [41.8057, 123.4315],
                    "大连": [38.9140, 121.6147],
                    "哈尔滨": [45.8038, 126.5349],
                    "济南": [36.6512, 117.1201],
                    "长春": [43.8171, 125.3235],
                    "石家庄": [38.0428, 114.5149],
                    "南宁": [22.8170, 108.3665],
                    "南昌": [28.6820, 115.8579],
                    "贵阳": [26.6470, 106.6302],
                    "海口": [20.0440, 110.1999],
                    "三亚": [18.2528, 109.5119],
                    "乌鲁木齐": [43.8256, 87.6168],
                    "兰州": [36.0611, 103.8343],
                    "银川": [38.4872, 106.2309],
                    "西宁": [36.6171, 101.7782],
                    "呼和浩特": [40.8427, 111.7508],
                    "香港": [22.3193, 114.1694],
                    "澳门": [22.1987, 113.5439],
                    "台北": [25.0330, 121.5654]
                };

                // 打开天气配置 Modal
                window.openWeatherModal = function(cfg) {
                    const modal = document.getElementById('weather-tool-modal');
                    if (!modal) return;

                    const cityPreset = document.getElementById('weather-city-preset');
                    const cityInput = document.getElementById('weather-city-input');
                    const latInput = document.getElementById('weather-lat-input');
                    const lonInput = document.getElementById('weather-lon-input');
                    const providerSelect = document.getElementById('weather-provider-select');
                    const apiKeyGroup = document.getElementById('weather-api-key-group');
                    const apiKeyInput = document.getElementById('weather-api-key-input');
                    const keyHelpText = document.getElementById('weather-key-help-text');
                    const testResult = document.getElementById('weather-test-result');

                    if (testResult) testResult.style.display = 'none';

                    // 回填数据
                    const currentCity = cfg.weather_city || '';
                    if (cityInput) cityInput.value = currentCity;
                    if (latInput) latInput.value = cfg.weather_lat !== undefined ? cfg.weather_lat : '';
                    if (lonInput) lonInput.value = cfg.weather_lon !== undefined ? cfg.weather_lon : '';
                    if (cityPreset) cityPreset.value = CITY_COORDS_MAP[currentCity] ? currentCity : '';

                    const currentProvider = cfg.weather_provider || 'auto';
                    if (providerSelect) providerSelect.value = currentProvider;
                    if (apiKeyInput) apiKeyInput.value = cfg.weather_api_key || '';

                    // 切换 Key 组可见性
                    const updateKeyVisibility = () => {
                        const p = providerSelect ? providerSelect.value : 'auto';
                        if (p === 'auto') {
                            apiKeyGroup.style.display = 'none';
                        } else {
                            apiKeyGroup.style.display = 'block';
                            if (p === 'qweather') {
                                keyHelpText.innerHTML = '和风天气 Key 申请：访问 <a href="https://dev.qweather.com" target="_blank" style="color:var(--accent-color);">dev.qweather.com</a> 免费申请（个人 1000次/天）。';
                            } else if (p === 'amap') {
                                keyHelpText.innerHTML = '高德地图 Key 申请：访问 <a href="https://lbs.amap.com" target="_blank" style="color:var(--accent-color);">lbs.amap.com</a> 申请“Web服务”类型的 API Key。';
                            } else if (p === 'seniverse') {
                                keyHelpText.innerHTML = '心知天气 Key 申请：访问 <a href="https://www.seniverse.com" target="_blank" style="color:var(--accent-color);">seniverse.com</a> 获取 API 密钥。';
                            }
                        }
                    };
                    updateKeyVisibility();

                    if (providerSelect && !providerSelect.dataset.bound) {
                        providerSelect.dataset.bound = 'true';
                        providerSelect.addEventListener('change', updateKeyVisibility);
                    }

                    if (cityPreset && !cityPreset.dataset.bound) {
                        cityPreset.dataset.bound = 'true';
                        cityPreset.addEventListener('change', () => {
                            const val = cityPreset.value;
                            if (val && CITY_COORDS_MAP[val]) {
                                cityInput.value = val;
                                latInput.value = CITY_COORDS_MAP[val][0];
                                lonInput.value = CITY_COORDS_MAP[val][1];
                            }
                        });
                    }

                    modal.classList.remove('hidden');
                };

                // 绑定 Weather Modal 关闭与操作按钮
                const btnCloseWeatherTool = document.getElementById('close-weather-tool-modal-btn');
                if (btnCloseWeatherTool && !btnCloseWeatherTool.dataset.bound) {
                    btnCloseWeatherTool.dataset.bound = 'true';
                    btnCloseWeatherTool.addEventListener('click', () => {
                        document.getElementById('weather-tool-modal').classList.add('hidden');
                    });
                }

                // 一键定位按钮
                const btnAutoLocate = document.getElementById('btn-auto-locate-weather');
                if (btnAutoLocate && !btnAutoLocate.dataset.bound) {
                    btnAutoLocate.dataset.bound = 'true';
                    btnAutoLocate.addEventListener('click', async () => {
                        const originalHTML = btnAutoLocate.innerHTML;
                        btnAutoLocate.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在探测...';
                        btnAutoLocate.disabled = true;

                        try {
                            const res = await fetch('/api/tools/weather/locate');
                            const data = await res.json();
                            if (data.status === 'success' && data.location) {
                                const loc = data.location;
                                const cityInput = document.getElementById('weather-city-input');
                                const latInput = document.getElementById('weather-lat-input');
                                const lonInput = document.getElementById('weather-lon-input');
                                const cityPreset = document.getElementById('weather-city-preset');

                                if (cityInput) cityInput.value = loc.city || '';
                                if (latInput) latInput.value = loc.lat || '';
                                if (lonInput) lonInput.value = loc.lon || '';
                                if (cityPreset && CITY_COORDS_MAP[loc.city]) {
                                    cityPreset.value = loc.city;
                                }

                                alert(`📍 定位成功！识别到当前网络位置为：${loc.province || ''} ${loc.city || ''} (经纬度: ${loc.lon}, ${loc.lat})`);
                            } else {
                                alert('自动定位失败：' + (data.message || '未知错误'));
                            }
                        } catch (e) {
                            alert('网络请求失败：' + e);
                        } finally {
                            btnAutoLocate.innerHTML = originalHTML;
                            btnAutoLocate.disabled = false;
                        }
                    });
                }

                // 测试天气接口按钮
                const btnTestWeather = document.getElementById('btn-test-weather');
                if (btnTestWeather && !btnTestWeather.dataset.bound) {
                    btnTestWeather.dataset.bound = 'true';
                    btnTestWeather.addEventListener('click', async () => {
                        const testResult = document.getElementById('weather-test-result');
                        const provider = document.getElementById('weather-provider-select').value;
                        const apiKey = document.getElementById('weather-api-key-input').value.trim();
                        const city = document.getElementById('weather-city-input').value.trim();
                        const lat = document.getElementById('weather-lat-input').value.trim();
                        const lon = document.getElementById('weather-lon-input').value.trim();

                        const originalHTML = btnTestWeather.innerHTML;
                        btnTestWeather.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在测试天气...';
                        btnTestWeather.disabled = true;

                        if (testResult) {
                            testResult.style.display = 'block';
                            testResult.style.borderColor = 'rgba(189, 147, 249, 0.4)';
                            testResult.style.color = '#bd93f9';
                            testResult.innerText = '正在向天气服务商发送测试请求并执行多级容灾检测...';
                        }

                        try {
                            const res = await fetch('/api/tools/weather/test', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({
                                    weather_provider: provider,
                                    weather_api_key: apiKey,
                                    weather_city: city,
                                    weather_lat: lat ? parseFloat(lat) : null,
                                    weather_lon: lon ? parseFloat(lon) : null
                                })
                            });
                            const data = await res.json();
                            if (data.status === 'success') {
                                testResult.style.borderColor = 'rgba(80, 250, 123, 0.5)';
                                testResult.style.color = '#50fa7b';
                                testResult.innerText = data.report || '测试成功！已正常获取天气数据。';
                            } else {
                                testResult.style.borderColor = 'rgba(255, 107, 139, 0.5)';
                                testResult.style.color = '#ff6b8b';
                                testResult.innerText = `[测试报错] ${data.message}`;
                            }
                        } catch (e) {
                            if (testResult) {
                                testResult.style.borderColor = 'rgba(255, 107, 139, 0.5)';
                                testResult.style.color = '#ff6b8b';
                                testResult.innerText = `[网络故障] 请求天气测试接口失败: ${e}`;
                            }
                        } finally {
                            btnTestWeather.innerHTML = originalHTML;
                            btnTestWeather.disabled = false;
                        }
                    });
                }

                // 保存天气配置按钮
                const btnSaveWeather = document.getElementById('btn-save-weather');
                if (btnSaveWeather && !btnSaveWeather.dataset.bound) {
                    btnSaveWeather.dataset.bound = 'true';
                    btnSaveWeather.addEventListener('click', async () => {
                        const provider = document.getElementById('weather-provider-select').value;
                        const apiKey = document.getElementById('weather-api-key-input').value.trim();
                        const city = document.getElementById('weather-city-input').value.trim();
                        const lat = document.getElementById('weather-lat-input').value.trim();
                        const lon = document.getElementById('weather-lon-input').value.trim();

                        const originalHTML = btnSaveWeather.innerHTML;
                        btnSaveWeather.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
                        btnSaveWeather.disabled = true;

                        try {
                            const payload = {
                                weather_provider: provider,
                                weather_api_key: apiKey,
                                weather_city: city,
                                weather_lat: lat ? parseFloat(lat) : null,
                                weather_lon: lon ? parseFloat(lon) : null
                            };

                            const res = await fetch('/api/settings/config', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify(payload)
                            });
                            const data = await res.json();
                            if (data.status === 'success' || data.success) {
                                alert('☀️ 天气与定位配置已成功保存并实时生效！');
                                document.getElementById('weather-tool-modal').classList.add('hidden');
                            } else {
                                alert('保存失败：' + (data.message || '未知错误'));
                            }
                        } catch (e) {
                            alert('保存失败：' + e);
                        } finally {
                            btnSaveWeather.innerHTML = originalHTML;
                            btnSaveWeather.disabled = false;
                        }
                    });
                }

                // 渲染 App Launcher 列表
                window.renderAppLauncherList = function() {
                    const listContainer = document.getElementById('app-launcher-list');
                    if (!listContainer) return;
                    listContainer.innerHTML = '';
                    
                    const keys = Object.keys(window.currentAppLauncherConfig || {});
                    if (keys.length === 0) {
                        listContainer.innerHTML = '<div style="color: #888; text-align: center; padding: 10px;">暂未配置任何应用，请在下方添加。</div>';
                        return;
                    }
                    
                    keys.forEach(alias => {
                        const path = window.currentAppLauncherConfig[alias];
                        const itemDiv = document.createElement('div');
                        itemDiv.style.display = 'flex';
                        itemDiv.style.alignItems = 'center';
                        itemDiv.style.justifyContent = 'space-between';
                        itemDiv.style.padding = '8px';
                        itemDiv.style.marginBottom = '8px';
                        itemDiv.style.backgroundColor = 'rgba(255,255,255,0.05)';
                        itemDiv.style.borderRadius = '6px';
                        
                        const textDiv = document.createElement('div');
                        textDiv.style.flex = '1';
                        textDiv.style.overflow = 'hidden';
                        textDiv.innerHTML = `<strong style="color: var(--accent-color);">${alias}</strong> <span style="color: #aaa; font-size: 12px; margin-left: 8px;" title="${path}">${path}</span>`;
                        
                        const delBtn = document.createElement('button');
                        delBtn.innerHTML = '<i class="fas fa-trash"></i>';
                        delBtn.className = 'action-btn';
                        delBtn.style.padding = '4px 8px';
                        delBtn.style.backgroundColor = 'rgba(255, 107, 139, 0.2)';
                        delBtn.style.color = '#ff6b8b';
                        delBtn.style.border = 'none';
                        delBtn.addEventListener('click', () => {
                            delete window.currentAppLauncherConfig[alias];
                            window.renderAppLauncherList();
                        });
                        
                        itemDiv.appendChild(textDiv);
                        itemDiv.appendChild(delBtn);
                        listContainer.appendChild(itemDiv);
                    });
                };

                // 绑定 App Launcher Modal 事件
                const btnCloseAppLauncher = document.getElementById('close-app-launcher-modal-btn');
                const btnSaveAppLauncher = document.getElementById('save-app-launcher-btn');
                const btnAddApp = document.getElementById('add-app-btn');
                
                if (btnCloseAppLauncher && !btnCloseAppLauncher.dataset.bound) {
                    btnCloseAppLauncher.dataset.bound = 'true';
                    btnCloseAppLauncher.addEventListener('click', () => {
                        document.getElementById('app-launcher-modal').classList.add('hidden');
                    });
                }
                
                if (btnAddApp && !btnAddApp.dataset.bound) {
                    btnAddApp.dataset.bound = 'true';
                    btnAddApp.addEventListener('click', () => {
                        const aliasInput = document.getElementById('new-app-alias');
                        const pathInput = document.getElementById('new-app-path');
                        const alias = aliasInput.value.trim();
                        const path = pathInput.value.trim();
                        
                        if (!alias || !path) {
                            alert('唤醒词和应用路径不能为空！');
                            return;
                        }
                        
                        window.currentAppLauncherConfig = window.currentAppLauncherConfig || {};
                        window.currentAppLauncherConfig[alias] = path;
                        
                        aliasInput.value = '';
                        pathInput.value = '';
                        window.renderAppLauncherList();
                    });
                }
                
                if (btnSaveAppLauncher && !btnSaveAppLauncher.dataset.bound) {
                    btnSaveAppLauncher.dataset.bound = 'true';
                    btnSaveAppLauncher.addEventListener('click', async () => {
                        try {
                            const parsed = window.currentAppLauncherConfig || {};
                            
                            const btn = btnSaveAppLauncher;
                            const originalHTML = btn.innerHTML;
                            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
                            
                            const res = await fetch('/api/settings/config', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({ app_launcher: parsed })
                            });
                            const data = await res.json();
                            if (data.status === 'success') {
                                alert('应用启动白名单已保存！');
                                document.getElementById('app-launcher-modal').classList.add('hidden');
                            } else {
                                alert('保存失败：' + data.message);
                            }
                            btn.innerHTML = originalHTML;
                        } catch (e) {
                            alert('保存失败：' + e);
                        }
                    });
                }
                
                // 绑定 Vision Tool Modal 关闭事件
                const btnCloseVisionTool = document.getElementById('close-vision-tool-modal-btn');
                if (btnCloseVisionTool && !btnCloseVisionTool.dataset.bound) {
                    btnCloseVisionTool.dataset.bound = 'true';
                    btnCloseVisionTool.addEventListener('click', () => {
                        document.getElementById('vision-tool-modal').classList.add('hidden');
                    });
                }
            } else {
                container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #ff6b8b;">获取工具列表失败。</div>';
            }
        } catch (e) {
            console.error('加载工具列表报错:', e);
            container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #ff6b8b;">网络或系统错误，加载失败。</div>';
        }
    };

});
