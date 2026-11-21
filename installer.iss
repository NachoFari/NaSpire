; NaSpire Studio — Instalador Oficial Windows (Inno Setup 6)
; Ecosistema NaSuite by NachoFari

#define MyAppName "NaSpire Studio"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "NachoFari (NaSuite)"
#define MyAppURL "https://github.com/NachoFari/NaSpire"
#define MyAppExeName "NaSpire.exe"

[Setup]
AppId={{9B2A4F10-6E31-4A8D-9C4E-8F1E2A7B5D01}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}/releases
DefaultDirName={autopf}\NaSuite\NaSpire
DefaultGroupName=NaSuite\NaSpire Studio
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=dist_installer
OutputBaseFilename=NaSpire-Setup-v{#MyAppVersion}
SetupIconFile=naspire.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
RestartApplications=yes

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo en el Escritorio"; GroupDescription: "Accesos directos:"

[Files]
Source: "dist\NaSpire\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Iniciar {#MyAppName}"; Flags: nowait postinstall skipifsilent
