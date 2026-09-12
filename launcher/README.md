# 启动器发行版

启动器是一个独立的 Electron 入口。它把正式程序放在用户可写的运行目录中，并把旧发行版里的难下载内容放在 `dependency-cache/legacy-release`。

更新流程固定为：

1. 从 `main` 获取最新版源码版本和提交号；
2. 下载该提交的源码 ZIP；
3. 下载 GitHub Release 中 `Rumia-Backend-<version>-<commit>.zip`；
4. 校验源码版本、后端 `backend-manifest.json` 的版本和 `source_commit`；
5. 以备份优先的方式替换正式程序，保留用户数据、角色记忆、配置和依赖缓存；
6. 用户点击“启动正式程序”后，使用更新后的源码和匹配后端运行。

后端包由根目录的 `build_backend_package.py` 生成。它会把当前 Git 提交号写入 `backend-manifest.json`，所以不能用任意旧版后端替代匹配包。

构建启动器：

```powershell
python build_launcher.py --legacy-release G:\code\rumia_clean_test_v2
```

只准备缓存、不构建安装包：

```powershell
python build_launcher.py --legacy-release G:\code\rumia_clean_test_v2 --no-installer
```
