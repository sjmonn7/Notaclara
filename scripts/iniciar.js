// Abre NotaClara en modo desarrollo (npm start).
// VS Code puede heredar ELECTRON_RUN_AS_NODE a sus terminales y tareas; con esa variable Electron
// se comporta como Node y la ventana no se abre, así que se quita antes de lanzar la app.
const { spawn } = require("node:child_process");
const path = require("node:path");

const electron = require("electron");

const entorno = { ...process.env };
delete entorno.ELECTRON_RUN_AS_NODE;

const proceso = spawn(electron, [path.join(__dirname, ".."), ...process.argv.slice(2)], { stdio: "inherit", env: entorno });
proceso.on("close", (codigo) => process.exit(codigo ?? 0));
