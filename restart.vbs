Set objShell = CreateObject("WScript.Shell")
WScript.Sleep 5000
objShell.Run "cmd /c start """" ""start.bat""", 1, False
