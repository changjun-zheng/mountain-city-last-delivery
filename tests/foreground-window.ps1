# Read-only focus diagnostics. The test launches this helper hidden and owns its PID.
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class ForegroundProbe {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
}
'@
$previousHandle = [IntPtr]::Zero
while ($true) {
  $foregroundHandle = [ForegroundProbe]::GetForegroundWindow()
  if ($foregroundHandle -ne $previousHandle) {
    $foregroundPid = [uint32]0
    [void][ForegroundProbe]::GetWindowThreadProcessId($foregroundHandle, [ref]$foregroundPid)
    $foregroundProcess = Get-Process -Id $foregroundPid -ErrorAction SilentlyContinue
    [ordered]@{ sourceEpochMs=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();
      hwnd=$foregroundHandle.ToInt64(); pid=$foregroundPid; process=$foregroundProcess.ProcessName } |
      ConvertTo-Json -Compress
    $previousHandle = $foregroundHandle
  }
  Start-Sleep -Milliseconds 50
}
