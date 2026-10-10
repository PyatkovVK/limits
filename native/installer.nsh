; Install for the current user. Finish launches directly and never waits for the app.
; Avoid Explorer's ExecShellAsUser delegation, which can stall the Finish button.
!ifndef BUILD_UNINSTALLER
  Function StartCodexLimits
    SetOutPath "$INSTDIR"
    Exec '"$INSTDIR\${PRODUCT_FILENAME}.exe" --hidden'
  FunctionEnd

  !macro customFinishPage
    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "StartCodexLimits"
    !insertmacro MUI_PAGE_FINISH
  !macroend
!endif
