# -*- coding: utf-8 -*-
import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://music.163.com/"
}

def search_music(keyword, limit=5):
    """
    搜索歌曲
    :param keyword: 关键词，如 '晴天 周杰伦'
    :param limit: 返回结果限制数量
    :return: 歌曲列表，包含id, name, artists, duration
    """
    search_url = "https://music.163.com/api/search/get/web"
    params = {
        "s": keyword,
        "type": 1,  # 1表示单曲
        "limit": limit
    }
    
    try:
        response = requests.get(search_url, params=params, headers=HEADERS, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get("code") == 200 and "result" in data:
                songs = data["result"].get("songs", [])
                results = []
                for s in songs:
                    results.append({
                        "id": s.get("id"),
                        "name": s.get("name"),
                        "artists": ", ".join([a.get("name") for a in s.get("artists", [])]),
                        "duration": s.get("duration", 0)  # 毫秒单位
                    })
                return results
    except Exception as e:
        print(f"[NETEASE API ERROR] search failed: {e}")
    return []

def get_play_url(song_id):
    """
    获取歌曲的音频重定向链接
    :param song_id: 网易云歌曲 ID
    :return: 音频流直链 (mp3)
    """
    # 采用网易云经典的客户端外链重定向接口 (必须使用 http 以免遭遇 HTTPS->HTTP 重定向降级阻断)
    return f"http://music.163.com/song/media/outer/url?id={song_id}.mp3"

def get_lyric(song_id):
    """
    获取歌曲的 LRC 歌词
    :param song_id: 网易云歌曲 ID
    :return: 歌词文本 (LRC格式)
    """
    lyric_url = f"https://music.163.com/api/song/lyric?id={song_id}&lv=1&kv=1&tv=-1"
    
    try:
        response = requests.get(lyric_url, headers=HEADERS, timeout=5)
        if response.status_code == 200:
            data = response.json()
            # 获取原歌词
            lrc = data.get("lrc", {}).get("lyric", "")
            return lrc
    except Exception as e:
        print(f"[NETEASE API ERROR] lyric fetch failed: {e}")
    return ""
