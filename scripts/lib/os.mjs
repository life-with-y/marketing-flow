// Mở thư mục và gửi thông báo hệ thống. Không bao giờ ném lỗi; không nội suy chuỗi vào shell.
import { spawn } from 'node:child_process';

function run(cmd, args, opts, spawnImpl) {
  try {
    const child = spawnImpl(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true, ...opts });
    child?.on?.('error', () => {});
    child?.unref?.();
  } catch {
    // bỏ qua
  }
}

export function openFolder(dir, platform = process.platform, spawnImpl = spawn) {
  if (platform === 'darwin') run('open', [dir], {}, spawnImpl);
  else if (platform === 'win32') run('explorer', [dir], {}, spawnImpl);
}

const WIN_SCRIPT = [
  'Add-Type -AssemblyName System.Windows.Forms',
  'Add-Type -AssemblyName System.Drawing',
  '$n = New-Object System.Windows.Forms.NotifyIcon',
  '$n.Icon = [System.Drawing.SystemIcons]::Information',
  '$n.Visible = $true',
  "$n.ShowBalloonTip(5000, $env:HM_TITLE, $env:HM_BODY, 'Info')",
  'Start-Sleep -Seconds 6',
  '$n.Dispose()',
].join('; ');

export function notify(title, body, platform = process.platform, spawnImpl = spawn) {
  if (platform === 'darwin') {
    run('osascript', [
      '-e', 'on run argv',
      '-e', 'display notification (item 1 of argv) with title (item 2 of argv)',
      '-e', 'end run',
      body, title,
    ], {}, spawnImpl);
  } else if (platform === 'win32') {
    run('powershell', ['-NoProfile', '-NonInteractive', '-Command', WIN_SCRIPT],
      { env: { ...process.env, HM_TITLE: title, HM_BODY: body } }, spawnImpl);
  }
}
