//! Leitura das informações do PC (somente leitura: nada é alterado).

use serde::Serialize;
use sysinfo::{CpuRefreshKind, Disks, MemoryRefreshKind, RefreshKind, System};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Memory {
    pub total_bytes: u64,
    pub used_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemDisk {
    pub mount_point: String,
    pub total_bytes: u64,
    pub free_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Overview {
    /// Ex.: "Windows 11 Pro 25H2 (build 26200.6899)"
    pub os_name: String,
    pub host_name: String,
    pub cpu_name: String,
    pub cpu_cores: usize,
    pub cpu_threads: usize,
    pub uptime_seconds: u64,
    pub memory: Memory,
    pub system_disk: Option<SystemDisk>,
}

fn err(e: sysinfo::Error) -> String {
    format!("{e:?}")
}

pub fn memory() -> Result<Memory, String> {
    let sys = System::new_with_specifics(
        RefreshKind::nothing().with_memory(MemoryRefreshKind::nothing().with_ram()),
    )
    .map_err(err)?;
    Ok(Memory {
        total_bytes: sys.total_memory(),
        used_bytes: sys.used_memory(),
    })
}

pub fn overview() -> Result<Overview, String> {
    let sys = System::new_with_specifics(
        RefreshKind::nothing()
            .with_memory(MemoryRefreshKind::nothing().with_ram())
            .with_cpu(CpuRefreshKind::nothing()),
    )
    .map_err(err)?;
    let cpus = sys.cpus();
    let cpu_name = cpus
        .first()
        .map(|c| c.brand().trim().to_string())
        .filter(|b| !b.is_empty())
        .unwrap_or_else(|| "Processador desconhecido".into());

    Ok(Overview {
        os_name: os_name(),
        host_name: System::host_name().unwrap_or_default(),
        cpu_name,
        cpu_cores: System::physical_core_count().unwrap_or(cpus.len()),
        cpu_threads: cpus.len(),
        uptime_seconds: System::uptime().unwrap_or(0),
        memory: Memory {
            total_bytes: sys.total_memory(),
            used_bytes: sys.used_memory(),
        },
        system_disk: system_disk(),
    })
}

/// O disco onde o sistema está instalado (C:\ no Windows, / nos outros).
fn system_disk() -> Option<SystemDisk> {
    let target = if cfg!(windows) {
        let drive = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".into());
        format!("{}\\", drive.trim_end_matches('\\')).to_uppercase()
    } else {
        "/".to_string()
    };
    let disks = Disks::new_with_refreshed_list().ok()?;
    disks
        .into_iter()
        .find(|d| d.mount_point().to_string_lossy().to_uppercase() == target)
        .map(|d| SystemDisk {
            mount_point: d.mount_point().to_string_lossy().into_owned(),
            total_bytes: d.total_space(),
            free_bytes: d.available_space(),
        })
}

#[cfg(windows)]
fn os_name() -> String {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;

    let key = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey("SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion");
    let Ok(key) = key else {
        return System::long_os_version().unwrap_or_else(|_| "Windows".into());
    };
    let get = |name: &str| key.get_value::<String, _>(name).unwrap_or_default();
    let mut product = get("ProductName");
    let build = get("CurrentBuild");
    let display = get("DisplayVersion");
    let ubr: u32 = key.get_value("UBR").unwrap_or(0);

    // O registro continua dizendo "Windows 10" no Windows 11; o build 22000+ é Windows 11.
    if build.parse::<u32>().unwrap_or(0) >= 22000 {
        product = product.replace("Windows 10", "Windows 11");
    }
    let mut name = product;
    if !display.is_empty() {
        name.push(' ');
        name.push_str(&display);
    }
    if !build.is_empty() {
        name.push_str(&format!(" (build {build}.{ubr})"));
    }
    name
}

#[cfg(not(windows))]
fn os_name() -> String {
    System::long_os_version().unwrap_or_else(|_| "Sistema desconhecido".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn overview_reads_real_values() {
        let o = overview().expect("leitura do sistema");
        assert!(o.memory.total_bytes > 0);
        assert!(o.memory.used_bytes <= o.memory.total_bytes);
        assert!(o.cpu_threads > 0);
        assert!(!o.os_name.is_empty());
    }
}
