Set objShell = CreateObject("WScript.Shell")
WScript.Sleep 3000
objShell.Run "cmd /c start """" ""start.bat""", 1, False
