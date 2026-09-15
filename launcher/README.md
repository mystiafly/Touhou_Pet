# 启动器发行版

启动器从远程 `main` 下载正式程序源码，并使用安装包内的固定 Python 依赖与当前项目模型缓存运行。运行内容全部放在启动器安装目录下：`runtime/` 保存正式源码与用户数据，`dependency-cache/` 保存难下载依赖，`logs/` 保存诊断日志。依赖在首次启动时异步展开；导入校验通过后才会开放正式程序启动按钮。后续更新只替换 `runtime/` 中的源码。

更新流程固定为：

1. 从 GitHub `main` 获取最新版源码版本，失败时切换到 Gitee 备用仓库；
2. 下载 `main` 分支源码 ZIP，GitHub 下载失败时切换到 Gitee；
3. 校验源码版本；若备用仓库版本落后则继续尝试其他地址；
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

如果检测到旧版 `%APPDATA%/rumia-launcher/runtime`，启动器会把源码和用户数据复制到安装目录，原目录保留不变；旧版依赖缓存不迁移，会从当前安装包重新准备。后端输出保存在安装目录下的 `logs/backend.log`。
