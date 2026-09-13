# 启动器发行版

启动器从远程 `main` 下载正式程序源码，并使用安装包内的固定 Python 依赖与当前项目模型缓存运行。依赖在首次启动时异步展开到启动器用户目录下的 `dependency-cache/`；导入校验通过后才会开放正式程序启动按钮。后续更新只替换 `runtime/` 中的源码。

更新流程固定为：

1. 从 `main` 获取最新版源码版本和提交号；
2. 下载该提交的源码 ZIP；
3. 校验源码版本；
4. 以备份优先的方式替换正式程序，保留用户数据、角色记忆和配置；依赖缓存独立存放，不随源码更新移动；
5. 使用固定 Python 依赖环境启动更新后的源码。

构建启动器：

```powershell
python build_launcher.py
```

如果项目根目录没有 `.venv`，可以显式指定一份兼容的虚拟环境：

```powershell
python build_launcher.py --python-env D:\rumia-runtime\.venv
```

只准备缓存、不构建安装包：

```powershell
python build_launcher.py --no-installer
```

旧版 `runtime/dependency-cache/` 会保留在更新备份中，但不会参与新版本的运行。后端输出保存在启动器用户目录下的 `logs/backend.log`。
