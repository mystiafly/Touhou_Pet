import os
import json
import time
import requests
from typing import Dict, Any, Tuple, Optional, List
from core.config_manager import get_config

# 国内常用省份与主要城市经纬度字典 (兜底快速映射)
MAJOR_CITIES_COORDS = {
    "北京": (39.9042, 116.4074),
    "上海": (31.2304, 121.4737),
    "广州": (23.1291, 113.2644),
    "深圳": (22.5431, 114.0579),
    "杭州": (30.2741, 120.1551),
    "南京": (32.0603, 118.7969),
    "成都": (30.5728, 104.0668),
    "武汉": (30.5928, 114.3055),
    "重庆": (29.5630, 106.5516),
    "西安": (34.3416, 108.9398),
    "天津": (39.0842, 117.2008),
    "苏州": (31.2990, 120.5853),
    "长沙": (28.2282, 112.9388),
    "郑州": (34.7466, 113.6253),
    "青岛": (36.0671, 120.3826),
    "合肥": (31.8206, 117.2272),
    "福州": (26.0745, 119.2965),
    "厦门": (24.4798, 118.0894),
    "昆明": (24.8801, 102.8329),
    "哈尔滨": (45.8038, 126.5349),
    "沈阳": (41.8057, 123.4315),
    "大连": (38.9140, 121.6147),
    "济南": (36.6512, 117.1201),
    "长春": (43.8171, 125.3235),
    "石家庄": (38.0428, 114.5149),
    "南宁": (22.8170, 108.3665),
    "南昌": (28.6820, 115.8579),
    "贵阳": (26.6470, 106.6302),
    "海口": (20.0440, 110.1999),
    "三亚": (18.2528, 109.5119),
    "兰州": (36.0611, 103.8343),
    "乌鲁木齐": (43.8256, 87.6168),
    "银川": (38.4872, 106.2309),
    "西宁": (36.6171, 101.7782),
    "拉萨": (29.6500, 91.1000),
    "呼和浩特": (40.8427, 111.7508),
    "香港": (22.3193, 114.1694),
    "澳门": (22.1987, 113.5439),
    "台北": (25.0330, 121.5654)
}

# WMO 天气代码转中文描述表
WMO_WEATHER_CODE_MAP = {
    0: "晴朗",
    1: "大部晴朗",
    2: "多云",
    3: "阴天",
    45: "有雾",
    48: "沉积雾/白霜",
    51: "轻微毛毛雨",
    53: "中度毛毛雨",
    55: "密集毛毛雨",
    56: "轻微冻毛毛雨",
    57: "密集冻毛毛雨",
    61: "小雨",
    63: "中雨",
    65: "大雨/暴雨",
    66: "轻微冻雨",
    67: "强冻雨",
    71: "小雪",
    73: "中雪",
    75: "大雪/暴雪",
    77: "雪粒/霰",
    80: "微弱阵雨",
    81: "中度阵雨",
    82: "剧烈阵雨",
    85: "小阵雪",
    86: "大阵雪",
    95: "雷阵雨",
    96: "雷阵雨伴有微弱冰雹",
    99: "雷阵雨伴有强冰雹"
}

def auto_detect_location() -> Dict[str, Any]:
    """通过公网 IP 自动检测当前所在城市及经纬度"""
    location_data = {
        "city": "北京",
        "lat": 39.9042,
        "lon": 116.4074,
        "province": "北京",
        "source": "default"
    }

    # 1. 尝试 ip-api.com (带中文语言)
    try:
        res = requests.get("http://ip-api.com/json/?lang=zh-CN", timeout=4)
        if res.status_code == 200:
            data = res.json()
            if data.get("status") == "success":
                city = data.get("city", "").replace("市", "").replace("省", "").strip()
                if city:
                    location_data["city"] = city
                    location_data["province"] = data.get("regionName", "")
                    location_data["lat"] = float(data.get("lat", 39.9042))
                    location_data["lon"] = float(data.get("lon", 116.4074))
                    location_data["source"] = "ip-api"
                    return location_data
    except Exception:
        pass

    # 2. 尝试 ipinfo.io
    try:
        res = requests.get("https://ipinfo.io/json", timeout=4)
        if res.status_code == 200:
            data = res.json()
            city = data.get("city", "")
            loc = data.get("loc", "")
            if city and loc and "," in loc:
                parts = loc.split(",")
                location_data["city"] = city
                location_data["lat"] = float(parts[0])
                location_data["lon"] = float(parts[1])
                location_data["source"] = "ipinfo"
                return location_data
    except Exception:
        pass

    return location_data

def resolve_target_location(city_query: str = "") -> Tuple[str, float, float]:
    """解析目标城市名称及经纬度 (支持用户指定城市、全局配置或自动感知)"""
    config = get_config()
    cfg_city = config.get("weather_city", "").strip()
    cfg_lat = config.get("weather_lat")
    cfg_lon = config.get("weather_lon")

    query = (city_query or "").strip()
    clean_query = query.replace("市", "").replace("县", "").replace("区", "").strip()

    # 1. 如果用户提问显式指定了具体城市
    if clean_query and clean_query.lower() != "auto":
        # 查字典
        if clean_query in MAJOR_CITIES_COORDS:
            lat, lon = MAJOR_CITIES_COORDS[clean_query]
            return clean_query, lat, lon
        for k, v in MAJOR_CITIES_COORDS.items():
            if k in clean_query or clean_query in k:
                return k, v[0], v[1]
        
        # 尝试通过 Open-Meteo Geocoding 查询经纬度
        try:
            geo_res = requests.get(f"https://geocoding-api.open-meteo.com/v1/search?name={clean_query}&count=1&language=zh", timeout=4)
            if geo_res.status_code == 200:
                geo_data = geo_res.json()
                if geo_data.get("results") and len(geo_data["results"]) > 0:
                    r = geo_data["results"][0]
                    return clean_query, float(r["latitude"]), float(r["longitude"])
        except Exception:
            pass

        # 默认回退到北京坐标，但使用用户查询的城市名
        return clean_query, 39.9042, 116.4074

    # 2. 如果配置中已明确保存了城市与坐标
    if cfg_city and cfg_lat is not None and cfg_lon is not None:
        try:
            return cfg_city, float(cfg_lat), float(cfg_lon)
        except Exception:
            pass

    if cfg_city and cfg_city in MAJOR_CITIES_COORDS:
        lat, lon = MAJOR_CITIES_COORDS[cfg_city]
        return cfg_city, lat, lon

    # 3. 自动 IP 定位探测
    detected = auto_detect_location()
    return detected["city"], detected["lat"], detected["lon"]


# ================== 各 API 独立数据抓取函数 ==================

def fetch_open_meteo(lat: float, lon: float, city: str) -> Dict[str, Any]:
    """免 Key API: Open-Meteo 高精度天气预报"""
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true&hourly=relative_humidity_2m,apparent_temperature,precipitation_probability&daily=temperature_2m_max,temperature_2m_min&timezone=auto"
    res = requests.get(url, timeout=6)
    if res.status_code != 200:
        raise Exception(f"Open-Meteo HTTP {res.status_code}: {res.text}")
    
    data = res.json()
    curr = data.get("current_weather", {})
    temp = curr.get("temperature", "N/A")
    wcode = curr.get("weathercode", 0)
    wdesc = WMO_WEATHER_CODE_MAP.get(wcode, "多云")
    wind = curr.get("windspeed", "N/A")

    daily = data.get("daily", {})
    temp_max = daily.get("temperature_2m_max", [temp])[0]
    temp_min = daily.get("temperature_2m_min", [temp])[0]

    # 获取当前小时相对湿度
    humidity = "未知"
    hourly = data.get("hourly", {})
    if hourly.get("relative_humidity_2m"):
        humidity = f"{hourly['relative_humidity_2m'][0]}%"

    # 给出简要贴士
    advice = "天气舒适，注意适时增减衣物。"
    if "雨" in wdesc or "暴雨" in wdesc:
        advice = "今天有降雨，出门请随身携带雨伞，注意防雨防滑！"
    elif "雪" in wdesc:
        advice = "今天有降雪天气，外面寒冷，出门请务必戴好手套围巾并注意防寒防滑！"
    elif isinstance(temp, (int, float)) and temp > 32:
        advice = "气温炎热，尽量避免在烈日下暴晒，注意多喝水防暑降温！"
    elif isinstance(temp, (int, float)) and temp < 10:
        advice = "气温偏低，天气寒冷，记得穿厚外套注意保暖别着凉啦！"

    return {
        "provider": "Open-Meteo (开源免Key)",
        "city": city,
        "weather": wdesc,
        "temperature": f"{temp}℃",
        "temp_range": f"{temp_min}℃ ~ {temp_max}℃",
        "humidity": humidity,
        "wind": f"{wind} km/h",
        "advice": advice
    }

def fetch_wttr_in(city: str) -> Dict[str, Any]:
    """免 Key API: wttr.in 极简天气"""
    # 城市名编码
    url = f"https://wttr.in/{city}?format=j1"
    headers = {"User-Agent": "curl/7.68.0", "Accept-Language": "zh-CN,zh;q=0.9"}
    res = requests.get(url, headers=headers, timeout=6)
    if res.status_code != 200:
        raise Exception(f"wttr.in HTTP {res.status_code}")
    
    data = res.json()
    curr = data.get("current_condition", [{}])[0]
    temp = curr.get("temp_C", "N/A")
    humidity = f"{curr.get('humidity', 'N/A')}%"
    desc = curr.get("lang_zh", [{}])[0].get("value", "") or curr.get("weatherDesc", [{}])[0].get("value", "多云")

    weather_day = data.get("weather", [{}])[0]
    max_t = weather_day.get("maxtempC", temp)
    min_t = weather_day.get("mintempC", temp)

    advice = "天气舒适，注意适时增减衣物。"
    if "雨" in desc or "Rain" in desc:
        advice = "有降雨可能，出门请携带雨伞！"
    elif "雪" in desc or "Snow" in desc:
        advice = "有降雪天气，外面寒冷，请注意防寒防冻！"
    elif str(temp).isdigit() and int(temp) > 32:
        advice = "天气炎热，注意防暑防晒多补充水分！"
    elif str(temp).isdigit() and int(temp) < 10:
        advice = "天气寒冷，出门请多穿保暖衣物！"

    return {
        "provider": "wttr.in (极简免Key)",
        "city": city,
        "weather": desc,
        "temperature": f"{temp}℃",
        "temp_range": f"{min_t}℃ ~ {max_t}℃",
        "humidity": humidity,
        "wind": f"{curr.get('windspeedKmph', 'N/A')} km/h",
        "advice": advice
    }

def fetch_qweather(api_key: str, city: str, lat: float, lon: float) -> Dict[str, Any]:
    """有 Key API: 和风天气 QWeather"""
    if not api_key:
        raise Exception("和风天气 API Key 为空")

    # 1. 查找 Location ID
    loc_id = f"{lon:.2f},{lat:.2f}"
    try:
        geo_url = f"https://geoapi.qweather.com/v2/city/lookup?location={city}&key={api_key}"
        geo_res = requests.get(geo_url, timeout=5)
        if geo_res.status_code == 200:
            geo_data = geo_res.json()
            if geo_data.get("code") == "200" and geo_data.get("location"):
                loc_id = geo_data["location"][0]["id"]
    except Exception:
        pass

    # 2. 查询实时天气
    now_url = f"https://devapi.qweather.com/v7/weather/now?location={loc_id}&key={api_key}"
    res = requests.get(now_url, timeout=6)
    if res.status_code != 200:
        raise Exception(f"和风天气 HTTP {res.status_code}: {res.text}")
    
    data = res.json()
    if data.get("code") != "200":
        raise Exception(f"和风天气返回错误码 {data.get('code')}")

    now = data.get("now", {})
    temp = now.get("temp", "N/A")
    feels_like = now.get("feelsLike", temp)
    text = now.get("text", "多云")
    wind_dir = now.get("windDir", "")
    wind_scale = now.get("windScale", "")
    humidity = f"{now.get('humidity', 'N/A')}%"

    # 3. 尝试查询 3 天预报以获取温差
    temp_range = f"{temp}℃"
    try:
        daily_url = f"https://devapi.qweather.com/v7/weather/3d?location={loc_id}&key={api_key}"
        d_res = requests.get(daily_url, timeout=4)
        if d_res.status_code == 200 and d_res.json().get("code") == "200":
            d0 = d_res.json()["daily"][0]
            temp_range = f"{d0.get('tempMin')}℃ ~ {d0.get('tempMax')}℃"
    except Exception:
        pass

    advice = "天气良好，祝你度过愉快的一天！"
    if "雨" in text:
        advice = "今天有雨，出门记得带上雨伞防雨哦！"
    elif "雪" in text:
        advice = "今天在下雪呢，外面好冷，多穿点衣服注意保暖！"
    elif str(temp).isdigit() and int(temp) > 32:
        advice = "气温较高，注意防晒降温，多喝水！"
    elif str(temp).isdigit() and int(temp) < 10:
        advice = "天气寒冷，体感温度较低，记得裹紧厚外套！"

    return {
        "provider": "和风天气 (QWeather)",
        "city": city,
        "weather": text,
        "temperature": f"{temp}℃ (体感 {feels_like}℃)",
        "temp_range": temp_range,
        "humidity": humidity,
        "wind": f"{wind_dir} {wind_scale}级",
        "advice": advice
    }

def fetch_amap(api_key: str, city: str) -> Dict[str, Any]:
    """有 Key API: 高德地图天气 (AMap)"""
    if not api_key:
        raise Exception("高德地图 API Key 为空")

    url = f"https://restapi.amap.com/v3/weather/weatherInfo?city={city}&key={api_key}&extensions=all"
    res = requests.get(url, timeout=6)
    if res.status_code != 200:
        raise Exception(f"高德地图 HTTP {res.status_code}")
    
    data = res.json()
    if data.get("status") != "1" or not data.get("forecasts"):
        # 降级请求实时
        base_url = f"https://restapi.amap.com/v3/weather/weatherInfo?city={city}&key={api_key}&extensions=base"
        base_res = requests.get(base_url, timeout=5)
        base_data = base_res.json()
        if base_data.get("status") == "1" and base_data.get("lives"):
            live = base_data["lives"][0]
            return {
                "provider": "高德地图 (AMap)",
                "city": live.get("city", city),
                "weather": live.get("weather", "晴"),
                "temperature": f"{live.get('temperature', 'N/A')}℃",
                "temp_range": f"{live.get('temperature', 'N/A')}℃",
                "humidity": f"{live.get('humidity', 'N/A')}%",
                "wind": f"{live.get('winddirection', '')}风 {live.get('windpower', '')}级",
                "advice": "出门前注意天气变化。"
            }
        raise Exception(f"高德地图查询失败: {data.get('info')}")

    f = data["forecasts"][0]
    today = f.get("casts", [{}])[0]
    w = today.get("dayweather", today.get("nightweather", "多云"))
    day_t = today.get("daytemp", "N/A")
    night_t = today.get("nighttemp", "N/A")

    advice = "天气宜人，适宜出行。"
    if "雨" in w:
        advice = "今天有雨，出门记得带伞！"
    elif "雪" in w:
        advice = "有降雪天气，注意防寒防滑！"
    elif str(day_t).isdigit() and int(day_t) > 32:
        advice = "高温预警，注意多补水防暑！"
    elif str(day_t).isdigit() and int(day_t) < 10:
        advice = "气温较低，添衣防寒保暖！"

    return {
        "provider": "高德地图 (AMap)",
        "city": f.get("city", city),
        "weather": w,
        "temperature": f"{day_t}℃",
        "temp_range": f"{night_t}℃ ~ {day_t}℃",
        "humidity": "适中",
        "wind": f"{today.get('daywind', '')}风 {today.get('daypower', '')}级",
        "advice": advice
    }

def fetch_seniverse(api_key: str, city: str) -> Dict[str, Any]:
    """有 Key API: 心知天气 (Seniverse)"""
    if not api_key:
        raise Exception("心知天气 API Key 为空")

    url = f"https://api.seniverse.com/v3/weather/now.json?key={api_key}&location={city}&language=zh-Hans&unit=c"
    res = requests.get(url, timeout=6)
    if res.status_code != 200:
        raise Exception(f"心知天气 HTTP {res.status_code}")
    
    data = res.json()
    if not data.get("results"):
        raise Exception("心知天气返回结果为空")

    r = data["results"][0]
    now = r.get("now", {})
    temp = now.get("temperature", "N/A")
    text = now.get("text", "多云")

    return {
        "provider": "心知天气 (Seniverse)",
        "city": r.get("location", {}).get("name", city),
        "weather": text,
        "temperature": f"{temp}℃",
        "temp_range": f"{temp}℃",
        "humidity": "良好",
        "wind": "微风",
        "advice": "关注天气变化，保持好心情。"
    }


# ================== 优先级与多级容灾主调度器 ==================

def get_weather_report(city_query: str = "") -> str:
    """获取格式化天气报告：
    1. 支持根据配置构建优先级 API 候选列表 (有Key优先 -> 免Key)；
    2. 单 API 自动重试 2 次；
    3. 持续失败自动跨 API 顺延 (最多 3 次)。
    """
    config = get_config()
    provider = config.get("weather_provider", "auto") # auto, qweather, amap, seniverse
    api_key = config.get("weather_api_key", "").strip()

    city, lat, lon = resolve_target_location(city_query)

    # 1. 组装候选 API 执行器列表
    candidate_runners = []

    # 如果用户配置了需要 Key 的特定服务商且提供了 Key，排在第一优先级
    if provider == "qweather" and api_key:
        candidate_runners.append(("和风天气", lambda: fetch_qweather(api_key, city, lat, lon)))
    elif provider == "amap" and api_key:
        candidate_runners.append(("高德地图", lambda: fetch_amap(api_key, city)))
    elif provider == "seniverse" and api_key:
        candidate_runners.append(("心知天气", lambda: fetch_seniverse(api_key, city)))
    elif api_key:
        # 用户填了 Key 但选了 auto，尝试和风天气
        candidate_runners.append(("和风天气", lambda: fetch_qweather(api_key, city, lat, lon)))

    # 免 Key 备用列表 (高可靠公用源)
    candidate_runners.append(("Open-Meteo", lambda: fetch_open_meteo(lat, lon, city)))
    candidate_runners.append(("wttr.in", lambda: fetch_wttr_in(city)))

    # 2. 执行容灾流水线：单 API 重试 2 次，顺延最多 3 个 API
    max_api_fallbacks = min(3, len(candidate_runners))
    last_error = ""

    for api_idx in range(max_api_fallbacks):
        name, runner = candidate_runners[api_idx]
        print(f"[WEATHER] 正在尝试调用天气源 #{api_idx + 1}: {name} (目标: {city}, 坐标: {lat:.2f},{lon:.2f})...")
        
        # 每个 API 重试 2 次
        for attempt in range(1, 3):
            try:
                result = runner()
                print(f"[WEATHER] 天气源 {name} 第 {attempt} 次调用成功！")
                
                # 组装结构化天气反馈
                report = (
                    f"【实时天气报告】\n"
                    f"城市/地区: {result.get('city', city)}\n"
                    f"天气状况: {result.get('weather', '多云')}\n"
                    f"当前气温: {result.get('temperature', 'N/A')}\n"
                    f"今日温差: {result.get('temp_range', 'N/A')}\n"
                    f"相对湿度: {result.get('humidity', 'N/A')}\n"
                    f"风向风速: {result.get('wind', 'N/A')}\n"
                    f"生活与穿衣建议: {result.get('advice', '适时增减衣物。')}\n"
                    f"(数据来源: {result.get('provider', name)})"
                )
                return report
            except Exception as e:
                last_error = str(e)
                print(f"[WEATHER WARN] 天气源 {name} 第 {attempt} 次调用失败: {e}")
                time.sleep(0.5) # 瞬时重试微间隔

        print(f"[WEATHER FAILOVER] 天气源 {name} 2次重试均失败，顺延降级至下一个天气源...")

    # 3. 如果所有候选 API 均未能成功返回
    return f"【天气获取提示】未能获取到 {city} 的最新天气状况（{last_error}）。请建议用户稍后重试或检查网络。"
