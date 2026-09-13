# 启动器发行版

启动器是一个独立的 Electron 入口。它把正式程序放在用户可写的运行目录中，把旧发行版里的难下载内容放在 `dependency-cache/legacy-release`，并把可搬运的 Python 解释器与第三方库放在 `dependency-cache/python-env`。

更新流程固定为：

1. 从 `main` 获取最新版源码版本和提交号；
2. 下载该提交的源码 ZIP；
3. 校验源码版本；
4. 以备份优先的方式替换正式程序，保留用户数据、角色记忆、配置和依赖缓存；
5. 使用固定 Python 依赖环境启动更新后的源码。

构建启动器：

```powershell
python build_launcher.py --legacy-release G:\code\rumia_clean_test_v2
```

如果项目根目录没有 `.venv`，可以显式指定一份兼容的虚拟环境：

```powershell
python build_launcher.py --legacy-release G:\code\rumia_clean_test_v2 --python-env D:\rumia-runtime\.venv
```

只准备缓存、不构建安装包：

```powershell
python build_launcher.py --legacy-release G:\code\rumia_clean_test_v2 --no-installer
```
