!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!ifndef BUILD_UNINSTALLER
  Var ShortcutDesktop
  Var ShortcutMenu
!endif
!macro customWelcomePage
  Page custom BatatuboWelcome
!macroend
!macro customPageAfterChangeDir
  Page custom BatatuboOptions BatatuboOptionsLeave
!macroend
!ifndef BUILD_UNINSTALLER
Function BatatuboWelcome
  !insertmacro MUI_HEADER_TEXT "Batatubo / terminal de mídia" "Sua mídia passa pelo tubo. A batata fica."
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 0 100% 62u " .----.    +==========+$\r$\n/ o  o \ ==| BATATUBO |==> [ mídia ]$\r$\n\__..__/   +==========+"
  Pop $0
  CreateFont $1 "Consolas" 12
  SendMessage $0 ${WM_SETFONT} $1 1
  ${NSD_CreateLabel} 0 72u 100% 80u "[ BEM-VINDO ] Versão ${VERSION}$\r$\n$\r$\nInstalação por usuário, sem administrador. Escolha a pasta e os atalhos nas próximas telas.$\r$\n$\r$\nNa primeira abertura, o aplicativo prepara yt-dlp e FFmpeg por HTTPS e verifica SHA-256. É necessária conexão.$\r$\n$\r$\nPrévia de testes. Este instalador não possui assinatura digital."
  Pop $0
  nsDialogs::Show
FunctionEnd
Function BatatuboOptions
  !insertmacro MUI_HEADER_TEXT "+-- REVISAR INSTALAÇÃO --+" "Confira o destino e escolha os atalhos."
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 0 100% 70u "[ APLICATIVO ] Batatubo ${VERSION}$\r$\n[ DESTINO ] $INSTDIR$\r$\n[ MODO ] Apenas este usuário$\r$\n$\r$\nO espaço necessário é calculado na tela de pasta. O motor obtido na primeira abertura precisa de espaço adicional. Nenhum início automático será criado."
  Pop $0
  ${NSD_CreateCheckbox} 0 85u 100% 16u "[ ] Criar atalho na área de trabalho"
  Pop $ShortcutDesktop
  ${NSD_CreateCheckbox} 0 110u 100% 16u "[ ] Criar atalho no menu Iniciar"
  Pop $ShortcutMenu
  nsDialogs::Show
FunctionEnd
Function BatatuboOptionsLeave
  ${NSD_GetState} $ShortcutDesktop $0
  StrCpy $ShortcutDesktop $0
  ${NSD_GetState} $ShortcutMenu $0
  StrCpy $ShortcutMenu $0
FunctionEnd
!endif
!macro customInstall
  ${If} $ShortcutDesktop == ${BST_CHECKED}
    CreateShortCut "$DESKTOP\Batatubo.lnk" "$INSTDIR\Batatubo.exe"
  ${EndIf}
  ${If} $ShortcutMenu == ${BST_CHECKED}
    CreateShortCut "$SMPROGRAMS\Batatubo.lnk" "$INSTDIR\Batatubo.exe"
  ${EndIf}
!macroend
!macro customUnInstall
  Delete "$DESKTOP\Batatubo.lnk"
  Delete "$SMPROGRAMS\Batatubo.lnk"
!macroend
!macro customUnInstallSection
  Section /o "un.Remover preferências do Batatubo (downloads preservados)"
    Delete "$APPDATA\Batatubo\preferences.json"
    RMDir /r "$APPDATA\Batatubo\Local Storage"
  SectionEnd
!macroend
