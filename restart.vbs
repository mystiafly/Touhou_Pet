Set objShell = CreateObject("Shell.Application")
WScript.Sleep 2000
objShell.ShellExecute "start.bat", "", "", "open", 1
