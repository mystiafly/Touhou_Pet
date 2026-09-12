'use strict';

const currentVersion = document.querySelector('#current-version');
const currentCommit = document.querySelector('#current-commit');
const statusText = document.querySelector('#status-text');
const statusDetail = document.querySelector('#status-detail');
const statusDot = document.querySelector('#status-dot');
const dependencyState = document.querySelector('#dependency-state');
const progressBar = document.querySelector('#progress-bar');
const checkButton = document.querySelector('#check-button');
const updateButton = document.querySelector('#update-button');
const launchButton = document.querySelector('#launch-button');
const quitButton = document.querySelector('#quit-button');

let latestUpdate = null;
let busy = false;

function setStatus(message, detail = '', state = '') {
  statusText.textContent = message;
  statusDetail.textContent = detail;
  statusDot.className = `status-dot ${state}`.trim();
}

function setBusy(value) {
  busy = value;
  checkButton.disabled = value;
  updateButton.disabled = value || !latestUpdate;
  launchButton.disabled = value || !window.__launcherState?.canLaunch;
}

function renderState(state) {
  window.__launcherState = state;
  currentVersion.textContent = state.version ? `v${state.version}` : '尚未安装';
  currentCommit.textContent = state.commit ? `源码 ${state.commit.slice(0, 8)}` : '等待检查';
  dependencyState.textContent = state.hasDependencyCache ? '已准备' : '未找到';
  setStatus(
    state.canLaunch ? '正式程序已就绪。' : '请先下载最新版正式程序。',
    state.backendStatus || '启动器不会覆盖依赖缓存和用户数据。',
    state.canLaunch ? 'ready' : '',
  );
  launchButton.disabled = busy || !state.canLaunch;
}

async function loadState() {
  try {
    renderState(await window.launcher.getState());
  } catch (error) {
    setStatus('无法读取本地运行环境。', error.message, 'error');
  }
}

checkButton.addEventListener('click', async () => {
  if (busy) return;
  setBusy(true);
  setStatus('正在检查远程版本…', '需要同时取得源码与对应后端。');
  try {
    latestUpdate = await window.launcher.checkForUpdate();
    if (latestUpdate.upToDate) {
      setStatus('当前已经是最新版本。', `v${latestUpdate.version} · ${latestUpdate.commit.slice(0, 8)}`, 'ready');
      latestUpdate = null;
    } else {
      setStatus('发现可用更新。', `v${latestUpdate.version} · ${latestUpdate.commit.slice(0, 8)}`, 'ready');
    }
  } catch (error) {
    latestUpdate = null;
    setStatus('检查更新失败。', error.message, 'error');
  } finally {
    setBusy(false);
  }
});

updateButton.addEventListener('click', async () => {
  if (busy || !latestUpdate) return;
  setBusy(true);
  progressBar.style.width = '0%';
  setStatus('正在下载更新…', '源码与后端会先完成校验，再替换正式程序。');
  try {
    const state = await window.launcher.installUpdate(latestUpdate);
    latestUpdate = null;
    progressBar.style.width = '100%';
    renderState(state);
    setStatus('更新完成，正在启动正式程序…', '用户数据和依赖缓存已保留。', 'ready');
    await window.launcher.launchFormalApp();
  } catch (error) {
    setStatus('更新失败，现有程序未被替换。', error.message, 'error');
  } finally {
    setBusy(false);
  }
});

launchButton.addEventListener('click', async () => {
  if (busy) return;
  setBusy(true);
  setStatus('正在启动正式程序…');
  try {
    await window.launcher.launchFormalApp();
  } catch (error) {
    setStatus('启动失败。', error.message, 'error');
    setBusy(false);
  }
});

quitButton.addEventListener('click', () => window.launcher.quit());
window.launcher.onProgress(({ percent, message }) => {
  if (Number.isFinite(percent)) progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  if (message) statusDetail.textContent = message;
});

loadState();
