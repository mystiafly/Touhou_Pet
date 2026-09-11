Option Explicit

Dim shell, fso, scriptDir, batchPath, configPath, configText, hideConsole, windowStyle

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
batchPath = fso.BuildPath(scriptDir, "start.bat")
configPath = fso.BuildPath(scriptDir, "services\global_config.json")
hideConsole = False

If fso.FileExists(configPath) Then
    On Error Resume Next
    configText = fso.OpenTextFile(configPath, 1, False, -1).ReadAll
    On Error GoTo 0

    Dim regex
    Set regex = New RegExp
    regex.Pattern = """hide_console""\s*:\s*true"
    regex.IgnoreCase = True
    regex.Global = False
    hideConsole = regex.Test(configText)
End If

If hideConsole Then
    windowStyle = 0
Else
    windowStyle = 1
End If

' Launching through wscript prevents the shortcut itself from creating a
' visible console. The batch file remains the single startup implementation.
shell.Run Chr(34) & batchPath & Chr(34), windowStyle, False
