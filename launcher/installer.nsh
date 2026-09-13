!macro customInit
  ; The old launcher keeps its executable open while its installer runs.
  ; Close only this product so NSIS can replace files in the same directory.
  nsExec::ExecToLog 'taskkill /F /IM "大贤者启动器.exe"'
!macroend
