// Sem janela de console atrás do app na versão final do Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    pulso_lab_lib::run()
}
